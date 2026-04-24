"use client";

/**
 * SearchBarWrapper — Client wrapper that syncs SearchBar with URL params
 */

import { SearchBar } from "@/components/search/search-bar";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchBarWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  return (
    <SearchBar
      defaultValue={q}
      onSearch={(query) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("q", query);
        router.push(`/buscar?${params.toString()}`);
      }}
    />
  );
}
