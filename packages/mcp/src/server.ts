/**
 * Secopia MCP Server Factory
 *
 * Creates a configured McpServer instance with all tools and resources
 * registered. This is the main entry point consumed by:
 *
 * - `bin/mcp.ts` — stdio transport for npx/Claude Desktop
 * - `apps/mcp-server` — HTTP transport for remote access
 *
 * @example
 * ```ts
 * import { createSecopiaServer } from "@secopia/mcp";
 *
 * const server = createSecopiaServer({ appToken: "your-token" });
 * ```
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SocrataClient } from "@secopia/socrata-client";
import type { SocrataClientOptions } from "@secopia/socrata-client";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

export interface SecopiaServerOptions {
  /** Socrata App Token for higher rate limits */
  appToken?: string;
  /** Override SocrataClient options (cache TTL, max entries, etc.) */
  clientOptions?: Partial<SocrataClientOptions>;
}

/**
 * Creates a fully configured Secopia MCP server.
 *
 * @param options - Server configuration
 * @returns A McpServer instance ready to be connected to a transport
 */
export function createSecopiaServer(options: SecopiaServerOptions = {}): McpServer {
  const client = new SocrataClient({
    appToken: options.appToken,
    ...options.clientOptions,
  });

  const server = new McpServer({
    name: "secopia",
    version: "0.1.0",
  });

  // Register MCP Resources (dataset discovery)
  registerResources(server);

  // Register MCP Tools (data queries)
  registerTools(server, client);

  return server;
}
