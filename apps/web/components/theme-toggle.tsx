"use client";

/**
 * ThemeToggle — light/dark mode switch
 *
 * Toggles the `dark` class on <html> and persists the choice in
 * localStorage. The inline boot script in layout.tsx applies the
 * stored/system preference before first paint; this button only
 * handles explicit user changes.
 */

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Reflect the class the boot script already applied (no flash).
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // private mode — preference just won't persist
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="rounded-md p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
    >
      {dark ? (
        <svg
          role="img"
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          role="img"
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
