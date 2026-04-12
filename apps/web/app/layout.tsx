import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Secopia — Buscador de Contratación Pública de Colombia",
    template: "%s | Secopia",
  },
  description:
    "Busca contratos y procesos de contratación pública en Colombia (SECOP I y II). Sin registro, sin CAPTCHA, open source.",
  keywords: [
    "SECOP",
    "contratación pública",
    "Colombia",
    "contratos",
    "datos abiertos",
    "transparencia",
  ],
  openGraph: {
    title: "Secopia — Buscador de Contratación Pública",
    description:
      "Busca contratos y procesos de contratación pública de Colombia. Datos de SECOP I y II.",
    type: "website",
    locale: "es_CO",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="border-b border-[var(--color-border)]">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <a href="/" className="text-xl font-bold tracking-tight">
                🔍 Secopia
              </a>
              <div className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
                <a
                  href="/buscar"
                  className="hover:text-[var(--color-foreground)] transition-colors"
                >
                  Buscar
                </a>
                <a
                  href="https://github.com/secopia/secopia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--color-foreground)] transition-colors"
                >
                  GitHub
                </a>
              </div>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="border-t border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-muted)]">
            <p>
              Secopia — Datos abiertos de{" "}
              <a
                href="https://www.datos.gov.co"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                datos.gov.co
              </a>
              {" "}· Open Source
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
