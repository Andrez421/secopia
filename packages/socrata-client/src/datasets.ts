/**
 * Dataset registry — Maps logical names to Socrata dataset IDs and field names.
 *
 * This is the SINGLE SOURCE OF TRUTH for all dataset metadata.
 * Both the web app and MCP server consume this registry.
 *
 * Field names must match the exact column names in datos.gov.co.
 * Verified against live API responses on 2026-04-12.
 */

import type { DatasetConfig, DatasetRegistry } from "@secopia/types";

export const DATASETS = {
  contratos: {
    id: "jbjy-vk9h",
    nombre: "SECOP II - Contratos",
    descripcion:
      "Contratos registrados en SECOP II. Incluye entidad contratante, proveedor, valor, fechas, modalidad y estado.",
    campos: {
      entidad: "nombre_entidad",
      proveedor: "proveedor_adjudicado",
      departamento: "departamento",
      descripcion: "objeto_del_contrato",
      valor: "valor_del_contrato",
      fecha_firma: "fecha_de_firma",
      modalidad: "modalidad_de_contratacion",
      nit_entidad: "nit_entidad",
      documento_proveedor: "documento_proveedor",
      estado: "estado_contrato",
      id_contrato: "id_contrato",
      tipo_contrato: "tipo_de_contrato",
      ciudad: "ciudad",
      fecha_inicio: "fecha_de_inicio_del_contrato",
      fecha_fin: "fecha_de_fin_del_contrato",
      url: "urlproceso",
      referencia: "referencia_del_contrato",
      descripcion_proceso: "descripcion_del_proceso",
    },
  },

  procesos: {
    id: "p6dx-8zbt",
    nombre: "SECOP II - Procesos de Contratación",
    descripcion:
      "Procesos de contratación publicados en SECOP II. Incluye fases, estados, precios base y modalidades.",
    campos: {
      entidad: "entidad",
      proveedor: "nombre_del_proveedor",
      departamento: "departamento_entidad",
      descripcion: "descripci_n_del_procedimiento",
      valor: "precio_base",
      fecha_firma: "fecha_de_publicacion_del",
      modalidad: "modalidad_de_contratacion",
      nit_entidad: "nit_entidad",
      documento_proveedor: "nit_del_proveedor_adjudicado",
      fase: "fase",
      estado: "estado_del_procedimiento",
      id_proceso: "id_del_proceso",
      ciudad: "ciudad_entidad",
      url: "urlproceso",
    },
  },

  secop1: {
    id: "f789-7hwg",
    nombre: "SECOP I - Procesos Históricos",
    descripcion:
      "Procesos de contratación históricos de SECOP I. Datos desde 2011. Incluye objeto, cuantía y estado.",
    campos: {
      entidad: "nombre_entidad",
      proveedor: "nom_razon_social_contratista",
      departamento: "departamento_entidad",
      descripcion: "objeto_a_contratar",
      valor: "cuantia_contrato",
      fecha_firma: "fecha_de_firma_del_contrato",
      modalidad: "modalidad_de_contratacion",
      nit_entidad: "nit_de_la_entidad",
      estado: "estado_del_proceso",
      detalle: "detalle_del_objeto_a_contratar",
      tipo_contrato: "tipo_de_contrato",
      anno: "anno_firma_contrato",
      url: "ruta_proceso_en_secop_i",
      documento_proveedor: "identificacion_del_contratista",
    },
  },
} as const satisfies DatasetRegistry;

/** Known dataset keys */
export type DatasetKey = keyof typeof DATASETS;

/**
 * Get a dataset config by its logical key.
 * @throws {Error} if the key is not found
 */
export function getDataset(key: string): DatasetConfig {
  if (!(key in DATASETS)) {
    throw new Error(`Unknown dataset: "${key}". Available: ${Object.keys(DATASETS).join(", ")}`);
  }
  return DATASETS[key as DatasetKey];
}
