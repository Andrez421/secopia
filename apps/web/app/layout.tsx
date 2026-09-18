import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";

// Applies the stored (or system) theme before first paint so the
// page never flashes the wrong color scheme.
const themeBootScript = `try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.classList.toggle("dark",d);e.classList.toggle("light",!d)}catch(e){}`;

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
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user data — required to set the theme class before paint */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="border-b border-[var(--color-border)]">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-xl font-bold tracking-tight">
                🔍 Secopia
              </Link>
              <div className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
                <Link
                  href="/buscar"
                  className="hover:text-[var(--color-foreground)] transition-colors"
                >
                  Buscar
                </Link>
                <ThemeToggle />
                <a
                  href="https://github.com/Andrez421/secopia"
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
              </a>{" "}
              · Open Source
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
