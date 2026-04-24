/**
 * MCP Tool registration — All Secopia tools
 *
 * Each tool follows the pattern:
 * 1. Zod schema validates inputs (automatic JSON Schema for MCP discovery)
 * 2. SoQLBuilder constructs sanitized queries
 * 3. SocrataClient executes with LRU caching
 * 4. Results returned as structured JSON
 * 5. Errors caught and returned with isError: true
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DATASETS, SoQLBuilder, type SocrataClient } from "@secopia/socrata-client";
import {
  buscarContratosSchema,
  buscarProcesosSchema,
  buscarProveedoresSchema,
  buscarSecop1Schema,
  detalleContratoSchema,
  estadisticasEntidadSchema,
  historialProveedorSchema,
  topProveedoresSchema,
} from "./schemas.js";

/** Wraps a tool result in the MCP content format */
function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

/** Wraps an error in the MCP error format */
function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: true,
} as const;

/**
 * Register all Secopia tools on the MCP server.
 */
export function registerTools(server: McpServer, client: SocrataClient): void {
  // ── buscar_contratos ──────────────────────────────────────

  server.registerTool(
    "buscar_contratos",
    {
      title: "Buscar Contratos SECOP II",
      description:
        "Busca contratos en SECOP II con filtros por entidad, proveedor, valor, fecha, departamento y modalidad. Devuelve los contratos más recientes primero.",
      inputSchema: buscarContratosSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.contratos;
        const q = new SoQLBuilder();

        if (args.entidad) q.like(ds.campos.entidad, args.entidad);
        if (args.proveedor) q.like(ds.campos.proveedor, args.proveedor);
        if (args.departamento) q.equals(ds.campos.departamento, args.departamento);
        if (args.modalidad) q.like(ds.campos.modalidad, args.modalidad);
        if (args.valor_min) q.gte(ds.campos.valor, args.valor_min);
        if (args.valor_max) q.lte(ds.campos.valor, args.valor_max);
        if (args.fecha_inicio) q.gte(ds.campos.fecha_firma, args.fecha_inicio);
        if (args.fecha_fin) q.lte(ds.campos.fecha_firma, args.fecha_fin);

        q.orderBy(ds.campos.fecha_firma).limit(args.limite);

        const results = await client.query(ds.id, q.build());
        return jsonResult({ contratos: results, total: results.length });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── buscar_procesos ───────────────────────────────────────

  server.registerTool(
    "buscar_procesos",
    {
      title: "Buscar Procesos SECOP II",
      description:
        "Busca procesos de contratación publicados en SECOP II. Incluye fases, estados, precios base y modalidades.",
      inputSchema: buscarProcesosSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.procesos;
        const q = new SoQLBuilder();

        if (args.entidad) q.like(ds.campos.entidad, args.entidad);
        if (args.descripcion) q.like(ds.campos.descripcion, args.descripcion);
        if (args.departamento) q.equals(ds.campos.departamento, args.departamento);

        q.orderBy(ds.campos.fecha_firma).limit(args.limite);

        const results = await client.query(ds.id, q.build());
        return jsonResult({ procesos: results, total: results.length });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── buscar_secop1 ─────────────────────────────────────────

  server.registerTool(
    "buscar_secop1",
    {
      title: "Buscar Procesos SECOP I (Históricos)",
      description:
        "Consulta procesos históricos de SECOP I (desde 2011). Útil para datos antiguos que no están en SECOP II.",
      inputSchema: buscarSecop1Schema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.secop1;
        const q = new SoQLBuilder();

        if (args.entidad) q.like(ds.campos.entidad, args.entidad);
        if (args.objeto) q.like(ds.campos.descripcion, args.objeto);
        if (args.departamento) q.equals(ds.campos.departamento, args.departamento);

        q.orderBy(ds.campos.fecha_firma).limit(args.limite);

        const results = await client.query(ds.id, q.build());
        return jsonResult({ procesos_secop1: results, total: results.length });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── buscar_proveedores ────────────────────────────────────

  server.registerTool(
    "buscar_proveedores",
    {
      title: "Buscar Proveedores",
      description:
        "Busca proveedores/contratistas registrados en SECOP II por nombre, NIT o departamento.",
      inputSchema: buscarProveedoresSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.contratos;
        const q = new SoQLBuilder().select([
          ds.campos.proveedor,
          ds.campos.documento_proveedor,
          ds.campos.departamento,
        ]);

        if (args.nombre) q.like(ds.campos.proveedor, args.nombre);
        if (args.nit) q.like(ds.campos.documento_proveedor, args.nit);
        if (args.departamento) q.equals(ds.campos.departamento, args.departamento);

        q.limit(args.limite);

        const results = await client.query(ds.id, q.build());
        return jsonResult({ proveedores: results, total: results.length });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── detalle_contrato ──────────────────────────────────────

  server.registerTool(
    "detalle_contrato",
    {
      title: "Detalle de Contrato",
      description:
        "Obtiene todos los campos de un contrato específico de SECOP II por su ID de contrato o ID de portafolio.",
      inputSchema: detalleContratoSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        if (!args.id_contrato && !args.id_portafolio) {
          return errorResult("Debes proporcionar id_contrato o id_portafolio");
        }

        const ds = DATASETS.contratos;
        const q = new SoQLBuilder();

        if (args.id_contrato) q.equals(ds.campos.id_contrato, args.id_contrato);
        if (args.id_portafolio) q.equals(ds.campos.referencia, args.id_portafolio);

        q.limit(1);

        const results = await client.query(ds.id, q.build());
        if (results.length === 0) {
          return jsonResult({ contrato: null, mensaje: "Contrato no encontrado" });
        }
        return jsonResult({ contrato: results[0] });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── historial_proveedor ───────────────────────────────────

  server.registerTool(
    "historial_proveedor",
    {
      title: "Historial de Proveedor",
      description:
        "Lista los contratos históricos de un proveedor en SECOP II, filtrados por su NIT. Ordenados por fecha de firma descendente.",
      inputSchema: historialProveedorSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.contratos;
        const q = new SoQLBuilder();

        q.equals(ds.campos.documento_proveedor, args.nit);
        if (args.fecha_inicio) q.gte(ds.campos.fecha_firma, args.fecha_inicio);

        q.orderBy(ds.campos.fecha_firma).limit(args.limite);

        const results = await client.query(ds.id, q.build());
        return jsonResult({
          nit: args.nit,
          contratos: results,
          total: results.length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── estadisticas_entidad ──────────────────────────────────

  server.registerTool(
    "estadisticas_entidad",
    {
      title: "Estadísticas de Entidad",
      description:
        "Obtiene contratos de una entidad para calcular estadísticas. Devuelve los datos crudos para que el LLM pueda calcular totales, promedios y distribuciones.",
      inputSchema: estadisticasEntidadSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.contratos;
        const q = new SoQLBuilder().select([
          ds.campos.valor,
          ds.campos.modalidad,
          ds.campos.proveedor,
          ds.campos.fecha_firma,
          ds.campos.estado,
        ]);

        q.like(ds.campos.entidad, args.nombre_entidad);
        if (args.anio) {
          q.gte(ds.campos.fecha_firma, `${args.anio}-01-01`);
          q.lte(ds.campos.fecha_firma, `${args.anio}-12-31`);
        }

        q.orderBy(ds.campos.fecha_firma).limit(100);

        const results = await client.query(ds.id, q.build());
        return jsonResult({
          entidad: args.nombre_entidad,
          anio: args.anio ?? "todos",
          contratos: results,
          total: results.length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── top_proveedores ───────────────────────────────────────

  server.registerTool(
    "top_proveedores",
    {
      title: "Contratos para Análisis de Proveedores",
      description:
        "Obtiene contratos crudos que permiten analizar y clasificar proveedores. Devuelve registros individuales de contratos para que el LLM pueda calcular rankings, totales y estadísticas por proveedor del lado del cliente.",
      inputSchema: topProveedoresSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ds = DATASETS.contratos;
        const q = new SoQLBuilder().select([
          ds.campos.proveedor,
          ds.campos.documento_proveedor,
          ds.campos.valor,
          ds.campos.entidad,
          ds.campos.fecha_firma,
        ]);

        if (args.entidad) q.like(ds.campos.entidad, args.entidad);
        if (args.departamento) q.equals(ds.campos.departamento, args.departamento);
        if (args.anio) {
          q.gte(ds.campos.fecha_firma, `${args.anio}-01-01`);
          q.lte(ds.campos.fecha_firma, `${args.anio}-12-31`);
        }

        q.orderBy(ds.campos.valor).limit(args.limite);

        const results = await client.query(ds.id, q.build());
        return jsonResult({ contratos: results, total: results.length });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
