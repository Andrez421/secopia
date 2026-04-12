/**
 * ContractCard — Summary card for a contract in search results
 *
 * Pure presentational component. No data fetching, no side effects.
 * Follows container-presentational pattern.
 *
 * Uses the CSS "stretched link" pattern to make the whole card clickable
 * while allowing nested <a> links for entity and provider — avoids the
 * invalid <a> inside <a> HTML nesting.
 */

import type { ContratoSECOP2 } from "@secopia/types";
import { formatCOP, formatDate, truncate } from "@/lib/utils";

interface ContractCardProps {
  contract: ContratoSECOP2;
}

export function ContractCard({ contract }: ContractCardProps) {
  const href = contract.id_contrato
    ? `/contrato/${encodeURIComponent(contract.id_contrato)}`
    : undefined;

  return (
    <article className="relative rounded-lg border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-accent)]/30">
      <CardContent contract={contract} href={href} />
    </article>
  );
}

function CardContent({
  contract,
  href,
}: ContractCardProps & { href?: string }) {
  return (
    <>
      {/* Header: Entity + Value */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">
            {contract.nombre_entidad ? (
              // Stretched link: covers the entire card via after:absolute after:inset-0
              // Inner links (entity, provider) sit above it via relative z-10
              href ? (
                <a
                  href={href}
                  className="after:absolute after:inset-0 hover:text-[var(--color-primary)] hover:underline"
                >
                  {contract.nombre_entidad}
                </a>
              ) : (
                <a
                  href={`/entidad/${encodeURIComponent(contract.nombre_entidad)}`}
                  className="relative z-10 hover:text-[var(--color-primary)] hover:underline"
                >
                  {contract.nombre_entidad}
                </a>
              )
            ) : (
              "Entidad no especificada"
            )}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">
            {contract.proveedor_adjudicado && contract.documento_proveedor ? (
              <a
                href={`/proveedor/${encodeURIComponent(contract.documento_proveedor)}`}
                className="relative z-10 hover:text-[var(--color-primary)] hover:underline"
              >
                {contract.proveedor_adjudicado}
              </a>
            ) : (
              contract.proveedor_adjudicado ?? "Proveedor no especificado"
            )}
          </p>
        </div>
        <span className="relative z-10 shrink-0 text-right font-mono text-sm font-semibold text-[var(--color-primary)]">
          {formatCOP(contract.valor_del_contrato)}
        </span>
      </div>

      {/* Description */}
      {contract.objeto_del_contrato && (
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {truncate(contract.objeto_del_contrato, 200)}
        </p>
      )}

      {/* Footer: Metadata tags */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
        {contract.departamento && (
          <span className="rounded-md bg-[var(--color-accent)] px-2 py-0.5">
            {contract.departamento}
          </span>
        )}
        {contract.modalidad_de_contratacion && (
          <span className="rounded-md bg-[var(--color-accent)] px-2 py-0.5">
            {contract.modalidad_de_contratacion}
          </span>
        )}
        {contract.fecha_de_firma && (
          <span>{formatDate(contract.fecha_de_firma)}</span>
        )}
        {contract.estado_contrato && (
          <span className="rounded-md bg-[var(--color-accent)] px-2 py-0.5">
            {contract.estado_contrato}
          </span>
        )}
      </div>
    </>
  );
}
