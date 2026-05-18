"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import { DocsCallout } from "./callout";
import { DocsScreenshotFrame } from "./screenshot-frame";
import { PlanBadge } from "./plan-badge";
import type { DocSection } from "@/lib/docs/types";

function resolve(val: string | string[] | undefined, fallback: string | string[] | undefined): string[] {
  const v = val ?? fallback;
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function DocsSections({ sections }: { sections: DocSection[] }) {
  const { locale } = useLanguage();

  return (
    <div className="mt-8 space-y-12">
      {sections.map((section) => {
        const title = (locale === "da" && section.title.da) ? section.title.da : section.title.en;
        const body = resolve(
          locale === "da" ? section.body.da : undefined,
          section.body.en,
        );
        const features = resolve(
          locale === "da" ? section.features?.da : undefined,
          section.features?.en,
        );
        const steps = resolve(
          locale === "da" ? section.steps?.da : undefined,
          section.steps?.en,
        );

        return (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xl font-bold text-foreground tracking-tight font-[family-name:var(--font-manrope)]">
                {title}
              </h2>
              {section.badge && <PlanBadge badge={section.badge} />}
            </div>

            {body.map((para, i) => (
              <p key={i} className="text-[15px] leading-7 text-slate-600 mb-4">
                {para}
              </p>
            ))}

            {features.length > 0 && (
              <ul className="space-y-2 my-4">
                {features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-slate-600">
                    <span className="mt-1.5 size-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            )}

            {steps.length > 0 && (
              <ol className="space-y-3 my-4">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] text-slate-600">
                    <span className="flex-shrink-0 size-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-6">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {section.callout && <DocsCallout callout={section.callout} />}
            {section.screenshot && <DocsScreenshotFrame screenshot={section.screenshot} />}
          </section>
        );
      })}
    </div>
  );
}
