"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { DocSection } from "@/lib/docs/types";

export function DocsToc({ sections }: { sections: DocSection[] }) {
  const { locale, t } = useLanguage();
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="sticky top-10 max-h-[calc(100vh-5rem)] overflow-y-auto pt-10 pl-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
        {t.docs.onThisPage}
      </p>
      <nav className="space-y-1">
        {sections.map((section) => {
          const title = (locale === "da" && section.title.da) ? section.title.da : section.title.en;
          const isActive = activeId === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`block text-[13px] py-0.5 transition-colors leading-5 ${
                isActive
                  ? "text-blue-600 font-semibold"
                  : "text-slate-500 hover:text-foreground"
              }`}
            >
              {title}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
