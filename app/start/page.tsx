import { ChatLandingApp } from "@/components/chat-landing/chat-landing-app";
import { LogoFull } from "@/components/logo";

export default function ChatLandingPage() {
  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#0a0f1e] text-white">
      {/* Site-standard atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(at 0% 0%, rgba(37,99,235,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(34,211,238,0.08) 0px, transparent 50%)",
        }}
      />
      {/* Faint register grid — the same surface the marketing hero sits on */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "clamp(56px, 7vw, 104px) 100%",
        }}
      />

      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/6 bg-[#0a0f1e]/80 px-4 backdrop-blur-2xl sm:px-6">
        <LogoFull size="small" variant="dark" />
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="hidden sm:inline">CVR-registret · live</span>
          <span className="sm:hidden">Live</span>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        <ChatLandingApp />
      </div>
    </main>
  );
}
