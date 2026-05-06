// Visible staging environment indicator — shown when NEXT_PUBLIC_ENV=staging.
// Server component: reads env at build time, renders nothing in production.

const env = process.env.NEXT_PUBLIC_ENV;

export function EnvBanner() {
  if (env !== "staging") return null;

  return (
    <div
      role="status"
      aria-label="Staging environment"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-950"
    >
      <span className="size-1.5 rounded-full bg-amber-800/60 animate-pulse" aria-hidden="true" />
      STAGING — ikke produktionsmiljø · Brug kun testdata
      <span className="size-1.5 rounded-full bg-amber-800/60 animate-pulse" aria-hidden="true" />
    </div>
  );
}
