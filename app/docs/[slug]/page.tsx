import { notFound } from "next/navigation";
import { ALL_DOCS } from "@/lib/docs/content";
import { ALL_DOC_SLUGS } from "@/lib/docs/nav";
import { DocsBreadcrumb } from "@/components/docs/breadcrumb";
import { DocsPageHeader } from "@/components/docs/page-header";
import { DocsSections } from "@/components/docs/sections";
import { DocsToc } from "@/components/docs/toc";
import { DocsFooterNav } from "@/components/docs/footer-nav";
import { DocsScreenshotFrame } from "@/components/docs/screenshot-frame";

export function generateStaticParams() {
  return ALL_DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = ALL_DOCS[slug];
  if (!doc) return {};
  return {
    title: `${doc.title.en} — CVR-MATE Docs`,
    description: doc.description.en,
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = ALL_DOCS[slug];
  if (!doc) notFound();

  return (
    <div className="flex max-w-[1200px] mx-auto w-full">
      {/* Main content */}
      <article className="flex-1 min-w-0 px-6 md:px-10 py-10 max-w-[780px]">
        <DocsBreadcrumb slug={slug} />
        <DocsPageHeader doc={doc} />
        {doc.heroScreenshot && <DocsScreenshotFrame screenshot={doc.heroScreenshot} />}
        <DocsSections sections={doc.sections} />
        <DocsFooterNav currentSlug={slug} />
      </article>

      {/* Right TOC */}
      <aside className="hidden xl:block w-[220px] shrink-0">
        <DocsToc sections={doc.sections} />
      </aside>
    </div>
  );
}
