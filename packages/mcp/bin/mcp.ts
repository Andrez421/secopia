#!/usr/bin/env node

/**
 * Secopia MCP — stdio entry point
 *
 * Usage:
 *   npx @secopia/mcp
 *   SOCRATA_APP_TOKEN=xxx npx @secopia/mcp
 *
 * Claude Desktop configuration (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "secopia": {
 *         "command": "npx",
 *         "args": ["@secopia/mcp"],
 *         "env": {
 *           "SOCRATA_APP_TOKEN": "your-token-here"
 *         }
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSecopiaServer } from "../src/server.js";

const server = createSecopiaServer({
  appToken: process.env.SOCRATA_APP_TOKEN,
});

const transport = new StdioServerTransport();
await server.connect(transport);
