/**
 * Zod schemas for MCP tool parameters.
 *
 * Centralized schemas ensure consistent validation across all tools
 * and provide automatic JSON Schema generation for MCP tool discovery.
 */

import { z } from "zod";

/** Reusable limit parameter: 1-100, default 20 */
const limitParam = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe("Cantidad máxima de resultados (1-100)");

/** Common search parameters shared across multiple tools */
const baseSearchParams = {
  entidad: z.string().optional().describe("Nombre parcial o completo de la entidad contratante"),
  departamento: z
    .string()
    .optional()
    .describe(
      "Departamento con el valor exacto del dataset, ej: 'Antioquia', 'Valle del Cauca', 'Distrito Capital de Bogotá', 'Cundinamarca'",
    ),
  limite: limitParam,
};

// ─── Tool Schemas ────────────────────────────────────────────

export const buscarContratosSchema = z.object({
  ...baseSearchParams,
  proveedor: z.string().optional().describe("Nombre parcial o completo del proveedor/contratista"),
  modalidad: z
    .string()
    .optional()
    .describe("Modalidad de contratación (ej: Contratación Directa, Licitación Pública)"),
  valor_min: z.number().optional().describe("Valor mínimo del contrato en pesos colombianos (COP)"),
  valor_max: z.number().optional().describe("Valor máximo del contrato en pesos colombianos (COP)"),
  fecha_inicio: z
    .string()
    .optional()
    .describe("Fecha mínima de firma del contrato (formato: YYYY-MM-DD)"),
  fecha_fin: z
    .string()
    .optional()
    .describe("Fecha máxima de firma del contrato (formato: YYYY-MM-DD)"),
});

export const buscarProcesosSchema = z.object({
  ...baseSearchParams,
  descripcion: z.string().optional().describe("Texto a buscar en la descripción del proceso"),
});

export const buscarSecop1Schema = z.object({
  ...baseSearchParams,
  objeto: z.string().optional().describe("Texto a buscar en el objeto a contratar"),
});

export const buscarProveedoresSchema = z.object({
  nombre: z.string().optional().describe("Nombre parcial o completo del proveedor"),
  nit: z.string().optional().describe("NIT del proveedor (sin dígito de verificación)"),
  departamento: z
    .string()
    .optional()
    .describe("Departamento con el valor exacto del dataset (ej: 'Antioquia', 'Cundinamarca')"),
  limite: limitParam,
});

export const detalleContratoSchema = z.object({
  id_contrato: z.string().optional().describe("ID del contrato en SECOP II"),
  id_portafolio: z.string().optional().describe("ID del portafolio del contrato"),
});

export const historialProveedorSchema = z.object({
  nit: z.string().describe("NIT del proveedor (sin dígito de verificación)"),
  fecha_inicio: z.string().optional().describe("Fecha desde la cual buscar contratos (YYYY-MM-DD)"),
  limite: limitParam,
});

export const estadisticasEntidadSchema = z.object({
  nombre_entidad: z.string().describe("Nombre de la entidad contratante"),
  anio: z.number().int().optional().describe("Año para filtrar estadísticas (ej: 2024)"),
});

export const topProveedoresSchema = z.object({
  entidad: z.string().optional().describe("Filtrar por entidad contratante"),
  departamento: z
    .string()
    .optional()
    .describe("Filtrar por departamento con el valor exacto del dataset (ej: 'Antioquia')"),
  anio: z.number().int().optional().describe("Filtrar por año"),
  limite: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Cantidad de proveedores en el ranking (1-50)"),
});
