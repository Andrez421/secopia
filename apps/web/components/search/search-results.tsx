"use client";

/**
 * SearchResults — Infinite scroll results list
 *
 * Uses TanStack Query's useInfiniteQuery for seamless pagination.
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
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const PAGE_SIZE = 20;

async function fetchResults(
  params: string,
  offset: number,
): Promise<SearchResponse<ContratoSECOP2>> {
  const separator = params ? "&" : "";
  const res = await fetch(`/api/buscar?${params}${separator}limite=${PAGE_SIZE}&offset=${offset}`);
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/** Returns true if query looks like a cédula/NIT (digits only, 5-15 chars) */
function isNumericQuery(q: string | null): boolean {
  return !!q && /^\d{5,15}$/.test(q.trim());
}

export function SearchResults() {
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const q = searchParams.get("q");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } =
    useInfiniteQuery({
      queryKey: ["search", paramsString],
      queryFn: ({ pageParam = 0 }) => fetchResults(paramsString, pageParam),
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.items.length < PAGE_SIZE) return undefined;
        return allPages.reduce((sum, p) => sum + p.items.length, 0);
      },
      initialPageParam: 0,
      enabled: paramsString.length > 0,
    });

  // Reset scroll to top when query/filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — scroll on query change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paramsString]);

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleObserver, {
      rootMargin: "200px",
    });
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [handleObserver]);

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
  const allItems = (data?.pages ?? []).flatMap((page) =>
    page.items.map((item) => normalizeContract(item as unknown as Record<string, unknown>, tipo)),
  );

  // No results
  if (allItems.length === 0) {
    return (
      <p className="py-12 text-center text-[var(--color-muted)]">
        No se encontraron resultados. Intenta con otros términos o filtros.
      </p>
    );
  }

  // ── NUMERIC QUERY: show provider profile card ─────────────────
  // Only for contratos — document lookup is only defined on that dataset
  if (isNumericQuery(q) && tipo === "contratos") {
    return (
      <div>
        <p className="pb-4 text-sm text-[var(--color-muted)]">
          Proveedor encontrado · {allItems.length} contrato{allItems.length !== 1 ? "s" : ""} en
          SECOP II
          {data?.pages[0]?.fromCache && " · desde caché"}
        </p>
        <ProviderCard contracts={allItems} />
      </div>
    );
  }

  // ── TEXT QUERY: show individual contract cards with infinite scroll ─
  return (
    <div>
      <p className="pb-4 text-sm text-[var(--color-muted)]">
        {allItems.length} resultados cargados
        {data?.pages[0]?.fromCache && " · desde caché"}
      </p>

      <div className="space-y-3">
        {allItems.map((item, index) => (
          <ContractCard key={item.id_contrato || `result-${index}`} contract={item} />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="py-8 text-center">
        {isFetchingNextPage && (
          <p className="text-sm text-[var(--color-muted)]">Cargando más resultados...</p>
        )}
      </div>
    </div>
  );
}
