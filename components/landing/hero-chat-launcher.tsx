"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";

/* ─── Hero Chat Launcher ──────────────────────────────────────────
   The hero's primary action is to *start the conversation*, not a bare
   "sign up". Typing an answer or tapping a prompt carries it into the
   chat funnel (/start?q=…), so the visitor lands already one turn in —
   the highest-intent way onto the qualified path.
─────────────────────────────────────────────────────────────────── */

export function HeroChatLauncher() {
  const { t } = useLanguage();
  const router = useRouter();
  const [value, setValue] = useState("");
  const l = t.hero.launcher;

  const launch = (text: string) => {
    const trimmed = text.trim();
    router.push(trimmed ? `/start?q=${encodeURIComponent(trimmed)}` : "/start");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      launch(value);
    }
  };

  return (
    <div className="max-w-[42ch]">
      {/* Input styled like the chat's own composer */}
      <div className="relative flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] p-2 pl-4 backdrop-blur-md transition-colors focus-within:border-cyan-400/50">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={l.placeholder}
          aria-label={l.placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-slate-500 outline-none"
        />
        <button
          type="button"
          onClick={() => launch(value)}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition-shadow hover:shadow-lg hover:shadow-cyan-500/25"
        >
          {l.start}
          <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-0.5">
            arrow_forward
          </span>
        </button>
      </div>

      {/* Tappable openers — the same seed prompts the chat itself offers */}
      <div className="mt-3 flex flex-wrap gap-2">
        {l.prompts.map((prompt: string) => (
          <button
            key={prompt}
            type="button"
            onClick={() => launch(prompt)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-slate-300 transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            {prompt}
          </button>
        ))}
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-slate-500">{l.caption}</p>
    </div>
  );
}
