/**
 * Secopia MCP Server — Remote HTTP endpoint
 *
 * Exposes the Secopia MCP server via Streamable HTTP transport.
 * Uses Node.js built-in `http` module — zero framework dependencies.
 *
 * This server is intended for remote MCP clients:
 * - Claude Desktop (remote mode)
 * - IDEs with MCP support
 * - Third-party AI tools
 *
 * The web app does NOT use this server — it calls Socrata directly.
 *
 * Architecture:
 * - Each client session gets its own transport instance
 * - Sessions are tracked by Mcp-Session-Id header
 * - Cleanup happens automatically when clients disconnect
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createSecopiaServer } from "@secopia/mcp";

// ─── Configuration ──────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3002);
const HOST = process.env.HOST ?? "0.0.0.0";

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SESSIONS = 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ─── Security ───────────────────────────────────────────────

/**
 * Optional bearer auth: when MCP_API_KEY is set, /mcp requires
 * `Authorization: Bearer <key>`. Unset means open access — fine for
 * local dev, unsafe for a public deployment (logged at startup).
 */
const MCP_API_KEY = process.env.MCP_API_KEY;

/**
 * Comma-separated origins allowed for browser clients. Native MCP
 * clients don't send Origin and are unaffected. When unset, no
 * Access-Control-Allow-Origin is emitted — browsers can't call us.
 */
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** Requests per minute per client IP on /mcp */
const RATE_LIMIT_PER_MIN = Number(process.env.MCP_RATE_LIMIT ?? 60);
const RATE_LIMIT_MAX_KEYS = 10_000;

// ─── MCP Server ─────────────────────────────────────────────

const mcpServer = createSecopiaServer({
  appToken: process.env.SOCRATA_APP_TOKEN,
});

// ─── Session Management ─────────────────────────────────────

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

/** Active transport sessions indexed by session ID */
const sessions = new Map<string, SessionEntry>();

// ─── Rate Limiting (fixed window, per client IP) ────────────

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateEntry>();

/** Client IP: last XFF hop (set by the closest proxy) or socket address */
function clientIp(req: import("node:http").IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const parts = xff.split(",");
    return parts[parts.length - 1]?.trim() || "unknown";
  }
  return req.socket.remoteAddress ?? "unknown";
}

/** Returns true if the request may proceed, false when the IP exceeded the limit */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now >= entry.resetAt) {
    // Bound the map: when full, expired entries are evicted on the cleanup pass
    if (rateLimits.size < RATE_LIMIT_MAX_KEYS) {
      rateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    }
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_PER_MIN;
}

/** Constant-time bearer check; open access when MCP_API_KEY is unset */
function isAuthorized(req: import("node:http").IncomingMessage): boolean {
  if (!MCP_API_KEY) return true;
  const header = req.headers.authorization;
  const expected = `Bearer ${MCP_API_KEY}`;
  if (typeof header !== "string" || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Read the full request body as a parsed JSON object, rejecting if it exceeds maxSize */
async function readBody(req: NodeJS.ReadableStream, maxSize: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    totalSize += buffer.length;
    if (totalSize > maxSize) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

/** Set CORS headers — only for allowlisted origins (native MCP clients send no Origin) */
function setCorsHeaders(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
): void {
  const origin = req.headers.origin;
  if (origin) {
    if (ALLOWED_ORIGINS.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

/** Send a JSON response */
function jsonResponse(
  res: import("node:http").ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ─── HTTP Server ────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: HTTP handler with sequential stages
const httpServer = createServer(async (req, res) => {
  setCorsHeaders(req, res);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check (unauthenticated on purpose — used by uptime probes)
  if (req.url === "/health" && req.method === "GET") {
    jsonResponse(res, 200, {
      status: "ok",
      activeSessions: sessions.size,
      uptime: process.uptime(),
    });
    return;
  }

  // MCP endpoint — every method requires auth + fits the rate limit
  if (
    req.url === "/mcp" &&
    (req.method === "POST" || req.method === "GET" || req.method === "DELETE")
  ) {
    if (!isAuthorized(req)) {
      jsonResponse(res, 401, { error: "Unauthorized. Send Authorization: Bearer <key>." });
      return;
    }

    if (!checkRateLimit(clientIp(req))) {
      jsonResponse(res, 429, { error: "Too many requests. Try again later." });
      return;
    }

    // GET (SSE stream) and DELETE (session close) act on existing sessions only
    if (req.method !== "POST") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const entry = sessionId ? sessions.get(sessionId) : undefined;
      if (!entry) {
        jsonResponse(res, 400, { error: "Unknown or missing Mcp-Session-Id." });
        return;
      }
      entry.lastActivity = Date.now();
      await entry.transport.handleRequest(req, res);
      return;
    }

    try {
      const body = await readBody(req, MAX_BODY_SIZE);
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Case 1: Existing session — reuse transport
      if (sessionId) {
        const entry = sessions.get(sessionId);
        if (entry) {
          entry.lastActivity = Date.now();
          await entry.transport.handleRequest(req, res, body);
          return;
        }
      }

      // Case 2: New session — must be an Initialize request
      if (!sessionId && isInitializeRequest(body)) {
        if (sessions.size >= MAX_SESSIONS) {
          jsonResponse(res, 429, {
            error: "Too many active sessions. Please try again later.",
          });
          return;
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            sessions.set(sid, { transport, lastActivity: Date.now() });
            console.log(`[session:new] ${sid} (active: ${sessions.size})`);
          },
        });

        // Cleanup on transport close — the TTL sweep handles abandoned
        // sessions; don't close on res "close" or keep-alive-less
        // clients lose their session right after initialize
        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
            console.log(`[session:closed] ${transport.sessionId} (active: ${sessions.size})`);
          }
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      // Case 3: Invalid request
      jsonResponse(res, 400, {
        error:
          "Invalid request. Send an Initialize request without Mcp-Session-Id to start a new session.",
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
        jsonResponse(res, 413, { error: "Payload too large. Maximum body size is 10 MB." });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_JSON") {
        jsonResponse(res, 400, { error: "Malformed JSON body." });
        return;
      }
      console.error("[mcp:error]", error);
      jsonResponse(res, 500, {
        error: "Internal server error processing MCP request.",
      });
    }
    return;
  }

  // 404
  jsonResponse(res, 404, { error: "Not found" });
});

// ─── Periodic Cleanup ───────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  let evicted = 0;
  for (const [sid, entry] of sessions) {
    if (now - entry.lastActivity > SESSION_TTL_MS) {
      entry.transport.close();
      sessions.delete(sid);
      evicted++;
    }
  }
  if (evicted > 0) {
    console.log(
      `[session:cleanup] Evicted ${evicted} inactive sessions (active: ${sessions.size})`,
    );
  }
  // Drop expired rate-limit windows so the map stays bounded
  for (const [ip, entry] of rateLimits) {
    if (now >= entry.resetAt) rateLimits.delete(ip);
  }
}, SESSION_CLEANUP_INTERVAL_MS);

// ─── Start ──────────────────────────────────────────────────

httpServer.on("error", (err) => {
  if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(`\n  ❌ Port ${PORT} is already in use.`);
    console.log("     Try: PORT=3003 pnpm dev\n");
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, HOST, () => {
  console.log("\n  🔍 Secopia MCP Server");
  console.log("  ─────────────────────");
  console.log(`  Health:  http://${HOST}:${PORT}/health`);
  console.log(`  MCP:     http://${HOST}:${PORT}/mcp`);
  console.log(
    `  Token:   ${process.env.SOCRATA_APP_TOKEN ? "configured ✓" : "not set (60 req/hr limit)"}`,
  );
  console.log(
    `  Auth:    ${MCP_API_KEY ? "MCP_API_KEY required ✓" : "OPEN — set MCP_API_KEY to require auth"}`,
  );
  console.log(
    `  CORS:    ${ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS.join(", ") : "no origins allowed (native clients only)"}`,
  );
  console.log(`  Limit:   ${RATE_LIMIT_PER_MIN} req/min per IP\n`);
});
