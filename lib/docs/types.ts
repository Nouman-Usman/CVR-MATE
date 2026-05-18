export type DocBadge = "Pro" | "Enterprise" | "Starter";
export type CalloutKind = "note" | "tip" | "warning" | "info";

export interface DocCallout {
  kind: CalloutKind;
  en: string;
  da?: string;
}

export interface DocScreenshot {
  /** Filename without extension → resolves to /docs/screenshots/<slug>.png */
  slug: string;
  alt: { en: string; da?: string };
  caption?: { en: string; da?: string };
}

export interface DocSection {
  /** kebab-case — used as <section id> and TOC anchor */
  id: string;
  title: { en: string; da?: string };
  body: { en: string | string[]; da?: string | string[] };
  features?: { en: string[]; da?: string[] };
  steps?: { en: string[]; da?: string[] };
  callout?: DocCallout;
  screenshot?: DocScreenshot;
  badge?: DocBadge;
}

export interface DocPage {
  slug: string;
  title: { en: string; da?: string };
  description: { en: string; da?: string };
  sections: DocSection[];
  heroScreenshot?: DocScreenshot;
}

export interface DocNavItem {
  slug: string;
  title: { en: string; da?: string };
}

export interface DocNavGroup {
  label: { en: string; da?: string };
  items: DocNavItem[];
}
