"use client";

/* ─── Suggested Replies ───────────────────────────────────────────
   Claude-style tappable answers under the latest question. They carry
   the exact text they'd send, so a tap is just a shortcut for typing —
   the input below stays available for anything off-menu.
─────────────────────────────────────────────────────────────────── */

export function SuggestedReplies({
  options,
  onPick,
  disabled,
}: {
  options: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option)}
          className="group inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-left text-[13px] font-medium text-slate-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option}
          <span
            aria-hidden
            className="text-cyan-400/30 transition-colors group-hover:text-cyan-400"
          >
            ↵
          </span>
        </button>
      ))}
    </div>
  );
}
