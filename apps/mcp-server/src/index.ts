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

import { randomUUID } from "node:crypto";
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
  return JSON.parse(raw);
}

/** Set CORS headers for cross-origin MCP clients */
function setCorsHeaders(res: import("node:http").ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
  setCorsHeaders(res);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" && req.method === "GET") {
    jsonResponse(res, 200, {
      status: "ok",
      activeSessions: sessions.size,
      uptime: process.uptime(),
    });
    return;
  }

  // MCP endpoint
  if (req.url === "/mcp" && req.method === "POST") {
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

        // Cleanup on transport close
        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
            console.log(`[session:closed] ${transport.sessionId} (active: ${sessions.size})`);
          }
        };

        // Cleanup on client disconnect
        res.on("close", () => {
          if (transport.sessionId && sessions.has(transport.sessionId)) {
            transport.close();
          }
        });

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
    `  Token:   ${process.env.SOCRATA_APP_TOKEN ? "configured ✓" : "not set (60 req/hr limit)"}\n`,
  );
});
