"use client";

/**
 * SearchFilters — Advanced filter controls
 *
 * All filter values are synced with URL search params,
 * allowing users to share filtered searches via URL.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const DEPARTAMENTOS = [
  "AMAZONAS",
  "ANTIOQUIA",
  "ARAUCA",
  "ATLANTICO",
  "BOGOTA",
  "BOLIVAR",
  "BOYACA",
  "CALDAS",
  "CAQUETA",
  "CASANARE",
  "CAUCA",
  "CESAR",
  "CHOCO",
  "CORDOBA",
  "CUNDINAMARCA",
  "GUAINIA",
  "GUAVIARE",
  "HUILA",
  "LA GUAJIRA",
  "MAGDALENA",
  "META",
  "NARINO",
  "NORTE DE SANTANDER",
  "PUTUMAYO",
  "QUINDIO",
  "RISARALDA",
  "SAN ANDRES",
  "SANTANDER",
  "SUCRE",
  "TOLIMA",
  "VALLE DEL CAUCA",
  "VAUPES",
  "VICHADA",
] as const;

export function SearchFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset offset when filters change
      params.delete("offset");
      router.push(`/buscar?${params.toString()}`);
    },
    [searchParams, router],
  );

  return (
    <div className="flex flex-wrap gap-3">
      {/* Entidad */}
      <input
        type="text"
        placeholder="Entidad contratante"
        value={searchParams.get("entidad") ?? ""}
        onChange={(e) => updateParam("entidad", e.target.value)}
        className="w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />

      {/* Proveedor */}
      <input
        type="text"
        placeholder="Proveedor / contratista"
        value={searchParams.get("proveedor") ?? ""}
        onChange={(e) => updateParam("proveedor", e.target.value)}
        className="w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />

      {/* Departamento */}
      <select
        value={searchParams.get("departamento") ?? ""}
        onChange={(e) => updateParam("departamento", e.target.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      >
        <option value="">Todos los departamentos</option>
        {DEPARTAMENTOS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {/* Tipo de dataset */}
      <select
        value={searchParams.get("tipo") ?? "contratos"}
        onChange={(e) => updateParam("tipo", e.target.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      >
        <option value="contratos">SECOP II - Contratos</option>
        <option value="procesos">SECOP II - Procesos</option>
        <option value="secop1">SECOP I - Históricos</option>
      </select>

      {/* Valor mínimo */}
      <input
        type="number"
        placeholder="Valor mínimo (COP)"
        value={searchParams.get("valor_min") ?? ""}
        onChange={(e) => updateParam("valor_min", e.target.value)}
        className="w-44 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />

      {/* Valor máximo */}
      <input
        type="number"
        placeholder="Valor máximo (COP)"
        value={searchParams.get("valor_max") ?? ""}
        onChange={(e) => updateParam("valor_max", e.target.value)}
        className="w-44 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}
