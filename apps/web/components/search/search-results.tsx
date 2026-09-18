"use client";

/**
 * SearchResults — Paginated results list
 *
 * Page-based pagination via `pagina` + `limite` URL params (30/50/100).
 * The API reports `hasMore` (limite+1 probe) plus a best-known `total`:
 * exact when `totalExact` (last page reached or background count landed),
 * otherwise a lower bound shown as "Más de N resultados".
 *
 * NUMERIC QUERY DETECTION:
 * When the query `q` is a pure digit string (5-15 chars), the API returns
 * contracts filtered by documento_proveedor. In this case we show a
 * ProviderCard (profile summary) instead of individual ContractCards,
 * since the user is clearly looking up a specific person/company.
 */

import { ContractCard } from "@/components/contract/contract-card";
import { ProviderCard } from "@/components/contract/provider-card";
import { normalizeContract } from "@/lib/normalize";
import type { ContratoSECOP2, SearchResponse } from "@secopia/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const PAGE_SIZES = [30, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 30;

async function fetchResults(params: string): Promise<SearchResponse<ContratoSECOP2>> {
  const res = await fetch(`/api/buscar?${params}`);
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/** Returns true if query looks like a cédula/NIT (digits only, 5-15 chars) */
function isNumericQuery(q: string | null): boolean {
  return !!q && /^\d{5,15}$/.test(q.trim());
}

function parsePageSize(value: string | null): number {
  const n = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: results component with sequential render states
export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramsString = searchParams.toString();
  const q = searchParams.get("q");

  const limite = parsePageSize(searchParams.get("limite"));
  const pagina = Math.max(1, Number.parseInt(searchParams.get("pagina") ?? "1", 10) || 1);

  // API params: strip UI-only params, inject limit/offset for this page
  const apiParams = new URLSearchParams(paramsString);
  apiParams.delete("pagina");
  apiParams.set("limite", String(limite));
  apiParams.set("offset", String((pagina - 1) * limite));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["search", apiParams.toString()],
    queryFn: () => fetchResults(apiParams.toString()),
    enabled: paramsString.length > 0,
  });

  // Scroll to top when the page changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — scroll on param change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paramsString]);

  function goToPage(page: number) {
    const params = new URLSearchParams(paramsString);
    params.set("pagina", String(page));
    router.push(`/buscar?${params.toString()}`);
  }

  function setPageSize(size: string) {
    const params = new URLSearchParams(paramsString);
    params.set("limite", size);
    params.delete("pagina");
    router.push(`/buscar?${params.toString()}`);
  }

  // Empty state
  if (!paramsString) {
    return (
      <p className="py-12 text-center text-[var(--color-muted)]">
        Ingresa un término de búsqueda para comenzar.
      </p>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            key={`skeleton-${i}`}
            className="h-32 animate-pulse rounded-lg bg-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  // Error
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        <p className="font-medium">Error en la búsqueda</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  const tipo = searchParams.get("tipo") ?? "contratos";
  // procesos/secop1 rows have different field names — normalize to the
  // ContratoSECOP2 display shape so cards render real data
  const items = (data?.items ?? []).map((item) =>
    normalizeContract(item as unknown as Record<string, unknown>, tipo),
  );

  // No results
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-muted)]">
          No se encontraron resultados. Intenta con otros términos o filtros.
        </p>
        {pagina > 1 && (
          <button
            type="button"
            onClick={() => goToPage(1)}
            className="mt-3 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-accent)]"
          >
            ← Volver a la página 1
          </button>
        )}
      </div>
    );
  }

  // ── NUMERIC QUERY: show provider profile card ─────────────────
  // Only for contratos — document lookup is only defined on that dataset
  if (isNumericQuery(q) && tipo === "contratos") {
    const providerCount = data?.totalExact ? data.total : items.length;
    return (
      <div>
        <p className="pb-4 text-sm text-[var(--color-muted)]">
          Proveedor encontrado · {providerCount}
          {data?.totalExact ? "" : "+"} contrato{providerCount !== 1 ? "s" : ""} en SECOP II
          {data?.fromCache && " · desde caché"}
        </p>
        <ProviderCard contracts={items} />
      </div>
    );
  }

  // ── TEXT QUERY: paginated contract cards ─────────────────────
  // hasMore comes from the API's limite+1 probe; the page-full heuristic
  // remains as a fallback for responses cached before the field existed.
  const hasNextPage = data?.hasMore ?? items.length >= limite;
  const isPartial = data?.partial === true;
  const total = data?.total ?? items.length;
  const totalExact = data?.totalExact === true;
  const totalPages = totalExact ? Math.ceil(total / limite) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <p className="text-sm text-[var(--color-muted)]">
          {isPartial
            ? `${total.toLocaleString("es-CO")} resultados · índice parcial`
            : totalExact
              ? `${total.toLocaleString("es-CO")} resultados`
              : `Más de ${total.toLocaleString("es-CO")} resultados`}
          {data?.fromCache && " · desde caché"}
        </p>

        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          Por página
          <select
            value={limite}
            onChange={(e) => setPageSize(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <ContractCard key={item.id_contrato || `result-${index}`} contract={item} />
        ))}
      </div>

      <Pagination
        pagina={pagina}
        totalPages={totalPages}
        hasNextPage={hasNextPage}
        onGoToPage={goToPage}
      />
    </div>
  );
}

/**
 * Pagination bar — prev/next plus a numbered window around the current
 * page. When the backend reports a real total (Typesense), the window is
 * bounded by totalPages; otherwise it extends optimistically while full
 * pages keep coming back.
 */
function Pagination({
  pagina,
  totalPages,
  hasNextPage,
  onGoToPage,
}: {
  pagina: number;
  totalPages?: number;
  hasNextPage: boolean;
  onGoToPage: (page: number) => void;
}) {
  const lastKnown = totalPages ?? (hasNextPage ? pagina + 1 : pagina);
  if (pagina <= 1 && !hasNextPage) return null;

  const pages: number[] = [];
  const windowStart = Math.max(1, Math.min(pagina - 2, lastKnown - 4));
  const windowEnd = Math.min(lastKnown, windowStart + 4);
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  const btnBase =
    "rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors";
  const btnEnabled = "hover:bg-[var(--color-accent)] text-[var(--color-foreground)]";
  const btnDisabled = "opacity-40 cursor-not-allowed text-[var(--color-muted)]";
  const btnActive = "border-[var(--color-primary)] bg-[var(--color-primary)] text-white";

  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex flex-wrap items-center justify-center gap-1.5"
    >
      <button
        type="button"
        onClick={() => onGoToPage(pagina - 1)}
        disabled={pagina <= 1}
        className={`${btnBase} ${pagina <= 1 ? btnDisabled : btnEnabled}`}
      >
        ← Anterior
      </button>

      {windowStart > 1 && (
        <>
          <PageButton page={1} pagina={pagina} onGoToPage={onGoToPage} />
          {windowStart > 2 && <span className="px-1 text-[var(--color-muted)]">…</span>}
        </>
      )}

      {pages.map((p) => (
        <PageButton key={p} page={p} pagina={pagina} onGoToPage={onGoToPage} />
      ))}

      {windowEnd < lastKnown && (
        <>
          {windowEnd < lastKnown - 1 && <span className="px-1 text-[var(--color-muted)]">…</span>}
          <PageButton page={lastKnown} pagina={pagina} onGoToPage={onGoToPage} />
        </>
      )}

      <button
        type="button"
        onClick={() => onGoToPage(pagina + 1)}
        disabled={!hasNextPage}
        className={`${btnBase} ${!hasNextPage ? btnDisabled : btnEnabled}`}
      >
        Siguiente →
      </button>
    </nav>
  );

  function PageButton({
    page,
    pagina: current,
    onGoToPage: go,
  }: { page: number; pagina: number; onGoToPage: (p: number) => void }) {
    return (
      <button
        type="button"
        onClick={() => go(page)}
        aria-current={page === current ? "page" : undefined}
        className={`${btnBase} min-w-9 ${page === current ? btnActive : btnEnabled}`}
      >
        {page}
      </button>
    );
  }
}
