import Link from "next/link";

export default function DocsNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
      <p className="text-5xl font-extrabold text-slate-200 font-[family-name:var(--font-manrope)]">404</p>
      <p className="text-muted-foreground">This documentation page doesn&apos;t exist.</p>
      <Link href="/docs/overview" className="text-sm text-blue-500 hover:underline">
        Back to documentation →
      </Link>
    </div>
  );
}
