/**
 * @secopia/types — SECOP contract and process interfaces
 *
 * These interfaces model the data returned by the Socrata SODA API
 * for Colombian public procurement datasets (SECOP I and II).
 *
 * Field names match the exact column names in datos.gov.co datasets.
 * Verified against live API responses on 2026-04-12.
 */

// ─── SECOP II — Contratos ────────────────────────────────────────

/** Raw contract record from SECOP II dataset (jbjy-vk9h) */
export interface ContratoSECOP2 {
  nombre_entidad: string;
  nit_entidad: string;
  departamento: string;
  ciudad: string;
  proveedor_adjudicado: string;
  documento_proveedor: string;
  objeto_del_contrato: string;
  tipo_de_contrato: string;
  modalidad_de_contratacion: string;
  valor_del_contrato: string;
  valor_facturado?: string;
  valor_pagado?: string;
  fecha_de_firma: string;
  fecha_de_inicio_del_contrato: string;
  fecha_de_fin_del_contrato: string;
  id_contrato: string;
  referencia_del_contrato?: string;
  urlproceso: string | { url: string };
  estado_contrato: string;
  codigo_de_categoria_principal?: string;
  descripcion_del_proceso?: string;
  nombre_supervisor?: string;
  tipodocproveedor?: string;
  // Financial fields (not always present in API response)
  valor_pendiente_de_pago?: string;
  // Provider/contractor identity fields
  codigo_proveedor?: string;
  domicilio_representante_legal?: string;
  // Legal representative fields
  nombre_representante_legal?: string;
  tipo_de_identificaci_n_representante_legal?: string;
  identificaci_n_representante_legal?: string;
  g_nero_representante_legal?: string;
}

// ─── SECOP II — Procesos ─────────────────────────────────────────

/** Raw process record from SECOP II dataset (p6dx-8zbt) */
export interface ProcesoSECOP2 {
  entidad: string;
  nit_entidad: string;
  departamento_entidad: string;
  ciudad_entidad: string;
  descripci_n_del_procedimiento: string;
  fase: string;
  fecha_de_publicacion_del: string;
  precio_base: string;
  modalidad_de_contratacion: string;
  estado_del_procedimiento: string;
  urlproceso: string | { url: string };
  id_del_proceso: string;
  nombre_del_proveedor?: string;
  nit_del_proveedor_adjudicado?: string;
}

// ─── SECOP I — Procesos ──────────────────────────────────────────

/** Raw process record from SECOP I dataset (f789-7hwg) */
export interface ProcesoSECOP1 {
  nombre_entidad: string;
  nit_de_la_entidad: string;
  departamento_entidad: string;
  objeto_a_contratar: string;
  detalle_del_objeto_a_contratar: string;
  tipo_de_contrato: string;
  modalidad_de_contratacion: string;
  cuantia_contrato: string;
  cuantia_proceso?: string;
  anno_firma_contrato: string;
  fecha_de_firma_del_contrato: string;
  estado_del_proceso: string;
  ruta_proceso_en_secop_i: string;
  nom_razon_social_contratista?: string;
  identificacion_del_contratista?: string;
}

// ─── Socrata API response types ──────────────────────────────────

/** Standard error response from Socrata SODA API */
export interface SocrataErrorResponse {
  code: string;
  error: boolean;
  message: string;
  data: Record<string, unknown>;
}
