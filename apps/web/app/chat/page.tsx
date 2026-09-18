/**
 * /chat — AI assistant page
 *
 * Mounts ChatPanel in a fixed-height container so the
 * message list scrolls independently from the page.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat con IA",
  description:
    "Pregunta sobre contratación pública de Colombia. El asistente consulta datos reales de SECOP I y II.",
};

export default function ChatPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-6rem)] max-w-3xl flex-col px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">Preguntale a Secopia</h1>
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] px-6 text-center">
        <p className="text-[var(--color-muted)]">
          El chat con IA no está disponible por el momento.
        </p>
      </div>
    </div>
  );
}
