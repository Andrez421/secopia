"use client";

/**
 * SearchBar — Main search input component
 *
 * On the home page: navigates to /buscar?q=...
 * On the search page: updates URL params (controlled by parent).
 */

import { useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  /** Initial search term (from URL params) */
  defaultValue?: string;
  /** If provided, calls this instead of navigating */
  onSearch?: (query: string) => void;
}

export function SearchBar({ defaultValue = "", onSearch }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      if (onSearch) {
        onSearch(trimmed);
      } else {
        router.push(`/buscar?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [query, onSearch, router],
  );

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar entidad, proveedor o contrato..."
        className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-base outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        autoComplete="off"
        autoFocus
      />
      <button
        type="submit"
        className="rounded-lg bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] active:scale-[0.98]"
      >
        Buscar
      </button>
    </form>
  );
}
