"use client";

/**
 * SearchFilters — Advanced filter controls
 *
 * All filter values are synced with URL search params,
 * allowing users to share filtered searches via URL.
 *
 * Text inputs debounce URL updates (400ms) to avoid one
 * request per keystroke. DEPARTAMENTOS uses the exact
 * values stored in the Socrata dataset (case + accents
 * matter for `equals` filters).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Exact `departamento` values from dataset jbjy-vk9h (verified live 2026-09)
const DEPARTAMENTOS = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Distrito Capital de Bogotá",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "No Definido",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés, Providencia y Santa Catalina",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

const DEBOUNCE_MS = 400;

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
      // Reset pagination when filters change
      params.delete("offset");
      params.delete("pagina");
      router.push(`/buscar?${params.toString()}`);
    },
    [searchParams, router],
  );

  return (
    <div className="flex flex-wrap gap-3">
      {/* Entidad */}
      <FilterInput
        param="entidad"
        placeholder="Entidad contratante"
        onCommit={updateParam}
        className="w-56"
      />

      {/* Proveedor */}
      <FilterInput
        param="proveedor"
        placeholder="Proveedor / contratista"
        onCommit={updateParam}
        className="w-56"
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

      {/* Modalidad */}
      <FilterInput
        param="modalidad"
        placeholder="Modalidad (ej. licitación)"
        onCommit={updateParam}
        className="w-48"
      />

      {/* Estado */}
      <FilterInput
        param="estado"
        placeholder="Estado exacto (ej. cancelado)"
        onCommit={updateParam}
        className="w-52"
      />

      {/* Ciudad */}
      <FilterInput
        param="ciudad"
        placeholder="Ciudad exacta (ej. Medellín)"
        onCommit={updateParam}
        className="w-52"
      />

      {/* Rango de fechas */}
      <DateInput param="fecha_desde" label="Desde" onCommit={updateParam} />
      <DateInput param="fecha_hasta" label="Hasta" onCommit={updateParam} />

      {/* Valor mínimo */}
      <FilterInput
        param="valor_min"
        placeholder="Valor mínimo (COP)"
        type="number"
        onCommit={updateParam}
        className="w-44"
      />

      {/* Valor máximo */}
      <FilterInput
        param="valor_max"
        placeholder="Valor máximo (COP)"
        type="number"
        onCommit={updateParam}
        className="w-44"
      />
    </div>
  );
}

/**
 * Text/number filter input with local state + debounced URL commit.
 * Local state keeps typing responsive; `committedRef` distinguishes
 * our own URL updates from external ones (select changes, back/forward)
 * so in-flight typing is never overwritten.
 */
function FilterInput({
  param,
  placeholder,
  type = "text",
  className = "",
  onCommit,
}: {
  param: string;
  placeholder: string;
  type?: "text" | "number";
  className?: string;
  onCommit: (key: string, value: string) => void;
}) {
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(param) ?? "");
  const committedRef = useRef(searchParams.get(param) ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external URL changes only — our own commits are already committedRef
  useEffect(() => {
    const external = searchParams.get(param) ?? "";
    if (external !== committedRef.current) {
      committedRef.current = external;
      setValue(external);
    }
  }, [searchParams, param]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      committedRef.current = next;
      onCommit(param, next);
    }, DEBOUNCE_MS);
  }

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] ${className}`}
    />
  );
}

/**
 * Date range filter — commits immediately on pick (no debounce needed:
 * a date input fires once per selection, not per keystroke).
 */
function DateInput({
  param,
  label,
  onCommit,
}: {
  param: string;
  label: string;
  onCommit: (key: string, value: string) => void;
}) {
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? "";

  return (
    <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onCommit(param, e.target.value)}
        className="bg-transparent text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </label>
  );
}
