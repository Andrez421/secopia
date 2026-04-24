/**
 * Provider utilities — shared logic for contractor / supplier cards and pages
 */

import type { ContratoSECOP2 } from "@secopia/types";

export function deriveCompanyType(tipodoc: string | undefined): string {
  if (!tipodoc) return "No especificado";
  const t = tipodoc.toLowerCase();
  if (t.includes("nit")) return "Persona Jurídica";
  if (t.includes("cédula") || t.includes("cedula")) return "Persona Natural Colombiana";
  if (t.includes("pasaporte")) return "Persona Natural Extranjera";
  return tipodoc;
}

export function isActive(contracts: ContratoSECOP2[]): boolean {
  return contracts.some(
    (c) =>
      c.estado_contrato?.toLowerCase().includes("ejecuci") ||
      c.estado_contrato?.toLowerCase() === "activo",
  );
}
