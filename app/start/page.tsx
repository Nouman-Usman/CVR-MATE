import { ChatLandingApp } from "@/components/chat-landing/chat-landing-app";
import { StartHeader } from "@/components/chat-landing/start-header";

export default async function ChatLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const seed = (Array.isArray(q) ? q[0] : q)?.slice(0, 500) || undefined;

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#0a0f1e] text-white">
      {/* Site-standard atmosphere, weighted to focus the centre column */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(at 50% 0%, rgba(37,99,235,0.16) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(34,211,238,0.08) 0px, transparent 50%)",
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
      <StartHeader />

      <div className="relative z-20 min-h-0 flex-1">
        <ChatLandingApp seed={seed} />
      </div>
    </main>
  );
}
