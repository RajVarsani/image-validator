import { useEffect, useState } from "react";
import { Search, Moon, Sun } from "lucide-react";
import Validator from "./modules/validator/index.js";
import { Button } from "./components/ui/button.js";
import { ensureSession } from "./modules/validator/queries.js";

export function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    ensureSession().then(setSessionId).catch((e) => console.error("session", e));
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <div className="min-h-full bg-bg">
      <div className="h-[3px]" style={{ background: "var(--color-brand)" }} />
      <header className="flex items-center justify-between border-b border-border px-10 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[19px] font-extrabold tracking-tight text-ink">aperture</span>
          <span className="text-[19px] font-medium tracking-tight text-faint">validator</span>
        </div>
        <nav className="flex items-center gap-6">
          <span className="text-sm font-medium text-muted">Docs</span>
          <span className="text-sm font-medium text-muted">Rules</span>
          <div className="flex items-center gap-2.5 rounded-button border border-border bg-surface py-1.5 pl-3 pr-2.5">
            <Search size={14} className="text-faint" />
            <span className="text-[13px] font-medium text-faint">Search</span>
            <span className="rounded-[5px] border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
              ⌘K
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </Button>
        </nav>
      </header>

      <main className="flex flex-col gap-7 px-10 py-12">
        <div className="flex max-w-3xl flex-col gap-4">
          <h1 className="text-[52px] font-extrabold leading-[54px] tracking-[-0.03em] text-ink">
            Upload photos. Keep only the good ones.
          </h1>
          <p className="max-w-xl text-lg leading-7 text-muted">
            Every image runs six checks: resolution, format, sharpness, duplicates, and a single
            well-sized face. We accept what passes and tell you exactly why the rest didn't.
          </p>
        </div>

        {sessionId ? (
          <Validator sessionId={sessionId} />
        ) : (
          <span className="text-sm text-muted">Starting a session…</span>
        )}
      </main>
    </div>
  );
}
