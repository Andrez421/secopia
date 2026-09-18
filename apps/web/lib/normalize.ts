/**
 * Dataset record normalization — maps raw Socrata rows from the
 * procesos and secop1 datasets onto the ContratoSECOP2 display shape
 * used by ContractCard / ProviderCard.
 *
 * `id_contrato` is intentionally left empty for non-contratos datasets:
 * the /contrato/[id] detail page only queries the contratos dataset,
 * so linking there would 404. Without an id, the card falls back to
 * linking the entity name instead.
 */

import type { ContratoSECOP2 } from "@secopia/types";

type RawRow = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeContract(item: RawRow, tipo: string): ContratoSECOP2 {
  if (tipo === "procesos") {
    return {
      nombre_entidad: str(item.entidad),
      nit_entidad: str(item.nit_entidad),
      departamento: str(item.departamento_entidad),
      ciudad: str(item.ciudad_entidad),
      proveedor_adjudicado: str(item.nombre_del_proveedor),
      documento_proveedor: str(item.nit_del_proveedor_adjudicado),
      objeto_del_contrato: str(item.descripci_n_del_procedimiento),
      tipo_de_contrato: "",
      modalidad_de_contratacion: str(item.modalidad_de_contratacion),
      valor_del_contrato: str(item.precio_base),
      fecha_de_firma: str(item.fecha_de_publicacion_del),
      fecha_de_inicio_del_contrato: "",
      fecha_de_fin_del_contrato: "",
      id_contrato: "",
      urlproceso: (item.urlproceso as ContratoSECOP2["urlproceso"]) ?? "",
      estado_contrato: str(item.estado_del_procedimiento),
    };
  }

  if (tipo === "secop1") {
    return {
      nombre_entidad: str(item.nombre_entidad),
      nit_entidad: str(item.nit_de_la_entidad),
      departamento: str(item.departamento_entidad),
      ciudad: "",
      proveedor_adjudicado: str(item.nom_razon_social_contratista),
      documento_proveedor: str(item.identificacion_del_contratista),
      objeto_del_contrato: str(item.objeto_a_contratar) || str(item.detalle_del_objeto_a_contratar),
      tipo_de_contrato: str(item.tipo_de_contrato),
      modalidad_de_contratacion: str(item.modalidad_de_contratacion),
      valor_del_contrato: str(item.cuantia_contrato),
      fecha_de_firma: str(item.fecha_de_firma_del_contrato),
      fecha_de_inicio_del_contrato: "",
      fecha_de_fin_del_contrato: "",
      id_contrato: "",
      urlproceso: str(item.ruta_proceso_en_secop_i),
      estado_contrato: str(item.estado_del_proceso),
    };
  }

  return item as unknown as ContratoSECOP2;
}
