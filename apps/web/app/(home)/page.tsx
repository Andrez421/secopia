/**
 * Home page — Landing with search bar
 *
 * Static page (generated at build time).
 * The search bar navigates to /buscar?q=... on submit.
 */

import { SearchBar } from "@/components/search/search-bar";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Contratación pública
          <br />
          <span className="text-[var(--color-primary)]">sin complicaciones</span>
        </h1>
        <p className="mt-4 text-lg text-[var(--color-muted)]">
          Busca contratos y procesos de SECOP I y II.
          <br />
          Sin registro, sin CAPTCHA, datos abiertos.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <SearchBar />
      </div>

      <div className="grid grid-cols-1 gap-4 text-center text-sm text-[var(--color-muted)] sm:grid-cols-3">
        <div>
          <p className="font-semibold text-[var(--color-foreground)]">Rápido</p>
          <p>Resultados en milisegundos con caché inteligente</p>
        </div>
        <div>
          <p className="font-semibold text-[var(--color-foreground)]">Abierto</p>
          <p>Datos públicos de datos.gov.co, código open source</p>
        </div>
        <div>
          <p className="font-semibold text-[var(--color-foreground)]">IA integrada</p>
          <p>Chat con IA que consulta datos en tiempo real</p>
        </div>
      </div>
    </div>
  );
}
