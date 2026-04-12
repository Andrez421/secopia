/**
 * ChatPanel — AI chat interface for Secopia
 *
 * Client component using Vercel AI SDK @ai-sdk/react v3 useChat hook.
 * Renders a chat panel with message history and input.
 *
 * Features:
 * - Streaming responses from /api/chat via DefaultChatTransport
 * - Auto-scroll to latest message
 * - Rate limit error handling
 * - Message parts rendering (text, tool invocations)
 */

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, type FormEvent } from "react";

const SUGGESTED_PROMPTS = [
  "¿Cuáles son los contratos más grandes de Bogotá este año?",
  "Busca contratos del Ministerio de Salud",
  "¿Cuánto ha contratado la Alcaldía de Medellín?",
];

const chatTransport = new DefaultChatTransport({ api: "/api/chat" });

export function ChatPanel() {
  const { messages, sendMessage, status, error } = useChat({
    transport: chatTransport,
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  function submitPrompt(prompt: string) {
    if (isLoading) return;
    sendMessage({ text: prompt });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-semibold">
              Preguntale a Secopia sobre contratación pública
            </h3>
            <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">
              Consulta datos reales de SECOP I y II. Pregunta por entidades,
              proveedores, contratos o departamentos.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitPrompt(prompt)}
                  className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                message.role === "user"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-accent)] text-[var(--color-foreground)]"
              }`}
            >
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return <MessageContent key={`${message.id}-${i}`} content={part.text} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-[var(--color-accent)] px-4 py-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-muted)]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-muted)] [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-muted)] [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error.message.includes("429")
              ? "Has alcanzado el límite de mensajes. Esperá un momento."
              : "Error al procesar tu mensaje. Intentá de nuevo."}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        id="chat-form"
        onSubmit={onSubmit}
        className="border-t border-[var(--color-border)] p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre contratos, entidades o proveedores..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Simple message content renderer.
 * Handles basic formatting: newlines → paragraphs, **bold**, `code`.
 */
function MessageContent({ content }: { content: string }) {
  if (!content) return null;

  const paragraphs = content.split("\n\n");

  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, i) => {
        const lines = paragraph.split("\n");
        return (
          <div key={`p-${i}`}>
            {lines.map((line, j) => (
              <p key={`l-${j}`}>
                <FormattedLine text={line} />
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FormattedLine({ text }: { text: string }) {
  // Process **bold** and `code` inline
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-[var(--color-border)] px-1 py-0.5 font-mono text-xs"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
