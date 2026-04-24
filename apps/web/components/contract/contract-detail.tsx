/**
 * ContractDetail — Full contract detail view
 *
 * Pure presentational component displaying all fields of a contract.
 */

import { formatCOP, formatDate } from "@/lib/utils";
import type { ContratoSECOP2 } from "@secopia/types";
import Link from "next/link";

interface ContractDetailProps {
  contract: ContratoSECOP2;
}

export function ContractDetail({ contract }: ContractDetailProps) {
  const url =
    typeof contract.urlproceso === "object" ? contract.urlproceso?.url : contract.urlproceso;

  const fields = [
    {
      label: "Entidad",
      value: contract.nombre_entidad,
      href: contract.nombre_entidad
        ? `/entidad/${encodeURIComponent(contract.nombre_entidad)}`
        : undefined,
    },
    { label: "NIT Entidad", value: contract.nit_entidad },
    {
      label: "Proveedor",
      value: contract.proveedor_adjudicado,
      href: contract.documento_proveedor
        ? `/proveedor/${encodeURIComponent(contract.documento_proveedor)}`
        : undefined,
    },
    { label: "Documento Proveedor", value: contract.documento_proveedor },
    { label: "Objeto", value: contract.objeto_del_contrato },
    { label: "Tipo de Contrato", value: contract.tipo_de_contrato },
    { label: "Modalidad", value: contract.modalidad_de_contratacion },
    { label: "Valor del Contrato", value: formatCOP(contract.valor_del_contrato) },
    { label: "Valor Pagado", value: formatCOP(contract.valor_pagado) },
    { label: "Departamento", value: contract.departamento },
    { label: "Ciudad", value: contract.ciudad },
    { label: "Fecha de Firma", value: formatDate(contract.fecha_de_firma) },
    { label: "Fecha de Inicio", value: formatDate(contract.fecha_de_inicio_del_contrato) },
    { label: "Fecha de Fin", value: formatDate(contract.fecha_de_fin_del_contrato) },
    { label: "Estado", value: contract.estado_contrato },
    { label: "ID Contrato", value: contract.id_contrato },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map(({ label, value, href }) => (
          <div key={label}>
            <dt className="text-sm font-medium text-[var(--color-muted)]">{label}</dt>
            <dd className="mt-1">
              {href && value ? (
                <Link href={href} className="text-[var(--color-primary)] hover:underline">
                  {value}
                </Link>
              ) : (
                value || "N/A"
              )}
            </dd>
          </div>
        ))}
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          Ver en SECOP ↗
        </a>
      )}
    </div>
  );
}
