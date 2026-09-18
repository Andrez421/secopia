/**
 * Tests for dataset record normalization
 *
 * Run with: node --test --import tsx apps/web/lib/normalize.test.ts
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { normalizeContract } from "./normalize";

describe("normalizeContract", () => {
  it("passes contratos records through unchanged", () => {
    const contrato = {
      nombre_entidad: "MINISTERIO DE SALUD",
      id_contrato: "CO1.PCCNTR.12345",
      valor_del_contrato: "150000000",
    };
    const result = normalizeContract(contrato, "contratos");
    assert.strictEqual(result.id_contrato, "CO1.PCCNTR.12345");
    assert.strictEqual(result.nombre_entidad, "MINISTERIO DE SALUD");
  });

  it("maps procesos fields onto the contract display shape", () => {
    const proceso = {
      entidad: "ALCALDÍA DE MEDELLÍN",
      nit_entidad: "890905211",
      departamento_entidad: "Antioquia",
      ciudad_entidad: "Medellín",
      nombre_del_proveedor: "CONSORCIO VIAL SAS",
      nit_del_proveedor_adjudicado: "901234567",
      descripci_n_del_procedimiento: "Mantenimiento de vías urbanas",
      modalidad_de_contratacion: "Licitación pública",
      precio_base: "5000000000",
      fecha_de_publicacion_del: "2025-03-10T00:00:00.000",
      estado_del_procedimiento: "Adjudicado",
      urlproceso: "https://example.com/proceso",
    };
    const result = normalizeContract(proceso, "procesos");
    assert.strictEqual(result.nombre_entidad, "ALCALDÍA DE MEDELLÍN");
    assert.strictEqual(result.departamento, "Antioquia");
    assert.strictEqual(result.ciudad, "Medellín");
    assert.strictEqual(result.proveedor_adjudicado, "CONSORCIO VIAL SAS");
    assert.strictEqual(result.documento_proveedor, "901234567");
    assert.strictEqual(result.objeto_del_contrato, "Mantenimiento de vías urbanas");
    assert.strictEqual(result.valor_del_contrato, "5000000000");
    assert.strictEqual(result.fecha_de_firma, "2025-03-10T00:00:00.000");
    assert.strictEqual(result.estado_contrato, "Adjudicado");
    // procesos have no contract detail page — id must stay empty
    assert.strictEqual(result.id_contrato, "");
  });

  it("maps secop1 fields onto the contract display shape", () => {
    const proceso = {
      nombre_entidad: "HOSPITAL UNIVERSITARIO DEL VALLE",
      nit_de_la_entidad: "890399010",
      departamento_entidad: "Valle del Cauca",
      nom_razon_social_contratista: "FARMACÉUTICA LTDA",
      identificacion_del_contratista: "800123456",
      objeto_a_contratar: "Suministro de medicamentos",
      detalle_del_objeto_a_contratar: "Para la red hospitalaria",
      tipo_de_contrato: "Prestación de servicios",
      modalidad_de_contratacion: "Concurso de méritos",
      cuantia_contrato: "1200000000",
      fecha_de_firma_del_contrato: "2018-07-01T00:00:00.000",
      estado_del_proceso: "Celebrado",
      ruta_proceso_en_secop_i: "https://example.com/secop1",
    };
    const result = normalizeContract(proceso, "secop1");
    assert.strictEqual(result.nombre_entidad, "HOSPITAL UNIVERSITARIO DEL VALLE");
    assert.strictEqual(result.nit_entidad, "890399010");
    assert.strictEqual(result.proveedor_adjudicado, "FARMACÉUTICA LTDA");
    assert.strictEqual(result.documento_proveedor, "800123456");
    assert.strictEqual(result.objeto_del_contrato, "Suministro de medicamentos");
    assert.strictEqual(result.valor_del_contrato, "1200000000");
    assert.strictEqual(result.urlproceso, "https://example.com/secop1");
    assert.strictEqual(result.id_contrato, "");
  });

  it("falls back to detalle when objeto_a_contratar is missing", () => {
    const result = normalizeContract(
      { detalle_del_objeto_a_contratar: "Solo detalle disponible" },
      "secop1",
    );
    assert.strictEqual(result.objeto_del_contrato, "Solo detalle disponible");
  });

  it("converts missing and non-string fields to empty strings", () => {
    const result = normalizeContract({}, "procesos");
    assert.strictEqual(result.nombre_entidad, "");
    assert.strictEqual(result.valor_del_contrato, "");
    assert.strictEqual(result.id_contrato, "");
  });
});
