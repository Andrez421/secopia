/**
 * MCP Resources — Dataset discovery for LLMs
 *
 * Exposes Secopia datasets as MCP Resources, allowing AI tools
 * to discover available data without executing queries.
 *
 * Resources are a first-class MCP concept — more appropriate than
 * a "list_datasets" tool for static metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATASETS } from "@secopia/socrata-client";

/**
 * Register all dataset-related resources on the MCP server.
 */
export function registerResources(server: McpServer): void {
  // Resource: List all available datasets
  server.resource(
    "datasets-disponibles",
    "secopia://datasets",
    {
      description:
        "Lista de todos los datasets de SECOP disponibles para consulta, con sus IDs y campos.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "secopia://datasets",
          mimeType: "application/json",
          text: JSON.stringify(
            Object.entries(DATASETS).map(([key, ds]) => ({
              key,
              id: ds.id,
              nombre: ds.nombre,
              descripcion: ds.descripcion,
              campos: Object.entries(ds.campos).map(([logical, actual]) => ({
                nombre_logico: logical,
                columna_socrata: actual,
              })),
            })),
            null,
            2,
          ),
        },
      ],
    }),
  );
}
