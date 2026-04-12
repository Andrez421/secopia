/**
 * ProviderCard — Summary card for a provider/contractor in search results
 *
 * Shown when the user searches by document number (cédula/NIT).
 * Groups all contracts under a single provider identity and links
 * to the full provider profile page.
 *
 * Pure presentational component — no data fetching.
 */

import type { ContratoSECOP2 } from "@secopia/types";
import { formatCOP } from "@/lib/utils";

interface ProviderCardProps {
  contracts: ContratoSECOP2[];
}

function deriveCompanyType(tipodoc: string | undefined): string {
  if (!tipodoc) return "No especificado";
  const t = tipodoc.toLowerCase();
  if (t.includes("nit")) return "Persona Jurídica";
  if (t.includes("cédula") || t.includes("cedula")) return "Persona Natural Colombiana";
  if (t.includes("pasaporte")) return "Persona Natural Extranjera";
  return tipodoc;
}

function isActive(contracts: ContratoSECOP2[]): boolean {
  return contracts.some(
    (c) =>
      c.estado_contrato?.toLowerCase().includes("ejecuci") ||
      c.estado_contrato?.toLowerCase() === "activo",
  );
}

export function ProviderCard({ contracts }: ProviderCardProps) {
  if (contracts.length === 0) return null;

  const first = contracts[0] as ContratoSECOP2;
  const nombre = first.proveedor_adjudicado ?? "Proveedor desconocido";
  const nit = first.documento_proveedor ?? "";
  const ciudad = first.ciudad;
  const departamento = first.departamento;
  const tipodoc = first.tipodocproveedor;
  const companyType = deriveCompanyType(tipodoc);
  const active = isActive(contracts);
  const codigoProveedor = first.codigo_proveedor;

  const totalValor = contracts.reduce((sum, c) => {
    const v = Number.parseFloat(c.valor_del_contrato ?? "0");
    return sum + (Number.isNaN(v) ? 0 : v);
  }, 0);

  const location = [ciudad, departamento].filter(Boolean).join(", ");

  const href = `/proveedor/${encodeURIComponent(nit)}`;

  return (
    <a
      href={href}
      className="block rounded-xl border border-[var(--color-border)] p-5 transition-colors hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-accent)]/20"
    >
      {/* Top row: breadcrumb + status + code */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Proveedor / Contratista
        </span>

        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            active
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-[var(--color-accent)] text-[var(--color-muted)]"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[var(--color-muted)]"}`} />
          {active ? "Proveedor Activo" : "Sin contratos activos"}
        </span>

        {codigoProveedor && (
          <span className="ml-auto font-mono">{codigoProveedor}</span>
        )}
      </div>

      {/* Name */}
      <h2 className="mb-2 text-xl font-bold uppercase tracking-wide text-[var(--color-foreground)]">
        {nombre}
      </h2>

      {/* NIT + Location */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
          </svg>
          NIT: <strong className="text-[var(--color-foreground)]">{nit}</strong>
        </span>

        {location && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {location.toUpperCase()}
          </span>
        )}
      </div>

      {/* Company type */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Tipo de empresa:
        </span>
        <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs">
          {companyType}
        </span>
      </div>

      {/* Footer: contracts count + total */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-sm">
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Registro Activo · {contracts.length} contrato{contracts.length !== 1 ? "s" : ""} encontrado{contracts.length !== 1 ? "s" : ""}
        </div>

        <span className="font-mono text-sm font-semibold text-[var(--color-primary)]">
          {formatCOP(totalValor)} total
        </span>
      </div>
    </a>
  );
}
