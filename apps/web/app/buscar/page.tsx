/**
 * /buscar — Search results page
 *
 * Dynamic page (Edge + Redis cache).
 * Renders SearchBar + SearchFilters + SearchResults.
 */

import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBarWrapper } from "./search-bar-wrapper";

export const metadata: Metadata = {
  title: "Buscar Contratos",
  description: "Busca contratos y procesos de contratación pública en SECOP I y II.",
};

export default function BuscarPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-4">
        <Suspense>
          <SearchBarWrapper />
        </Suspense>

        <Suspense>
          <SearchFilters />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="space-y-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  key={`skeleton-${i}`}
                  className="h-32 animate-pulse rounded-lg bg-[var(--color-border)]"
                />
              ))}
            </div>
          }
        >
          <SearchResults />
        </Suspense>
      </div>
    </div>
  );
}
