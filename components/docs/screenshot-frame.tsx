"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { DocScreenshot } from "@/lib/docs/types";

export function DocsScreenshotFrame({ screenshot }: { screenshot: DocScreenshot }) {
  const { locale, t } = useLanguage();
  const [hasError, setHasError] = useState(false);
  const src = `/docs/screenshots/${screenshot.slug}.png`;
  const alt = (locale === "da" && screenshot.alt.da) ? screenshot.alt.da : screenshot.alt.en;
  const caption = screenshot.caption
    ? ((locale === "da" && screenshot.caption.da) ? screenshot.caption.da : screenshot.caption.en)
    : null;

  return (
    <figure className="my-6">
      <div className="rounded-xl border border-border shadow-lg overflow-hidden">
        {/* Browser chrome */}
        <div className="bg-slate-100 h-8 flex items-center px-3 gap-1.5 border-b border-slate-200">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        {hasError ? (
          <div className="bg-muted/60 border-t-0 flex flex-col items-center justify-center h-[280px] gap-3 text-muted-foreground">
            <Camera className="size-8 opacity-40" />
            <span className="text-sm">{t.docs.screenshotPlaceholder}</span>
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={675}
            className="w-full h-auto"
            onError={() => setHasError(true)}
          />
        )}
      </div>
      {caption && (
        <figcaption className="text-center text-xs text-muted-foreground mt-2">{caption}</figcaption>
      )}
    </figure>
  );
}
