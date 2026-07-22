import { ChatLandingApp } from "@/components/chat-landing/chat-landing-app";
import { LogoFull } from "@/components/logo";

export default function ChatLandingPage() {
  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#0a0f1e] text-white relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(at 0% 0%, rgba(37,99,235,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(34,211,238,0.08) 0px, transparent 50%)",
        }}
      />

      <header className="relative shrink-0 h-14 flex items-center justify-between px-4 sm:px-6 border-b border-white/6 bg-[#0a0f1e]/80 backdrop-blur-2xl z-10">
        <LogoFull size="small" variant="dark" />
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="hidden sm:inline">Connected to the Danish CVR registry</span>
          <span className="sm:hidden">Live CVR</span>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 z-10">
        <ChatLandingApp />
      </div>
    </main>
  );
}

