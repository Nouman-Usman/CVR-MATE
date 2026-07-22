"use client";

import { useLanguage } from "@/lib/i18n/language-context";

/* ─── Feature Drawer ──────────────────────────────────────────────
   The hero is one card on top of the index. This is the drawer pulled
   open: features filed behind paper tab dividers.

   Real card-index tabs are cut at staggered positions so every label
   stays readable when you look into the drawer — that stagger is the
   structural device here, not decoration.

   The grouping is the sales motion itself (find → understand → act →
   watch), and each row is tagged with where its data actually comes
   from, which is the thing a buyer wants to know.
─────────────────────────────────────────────────────────────────── */

type GroupKey = "find" | "understand" | "act" | "watch";
type SourceKey = "cvr" | "ai" | "app";

/** Maps each feature (by its index in t.features.items) to a drawer
 *  section and to where its data comes from. */
const FILING: { group: GroupKey; items: { index: number; source: SourceKey }[] }[] = [
  {
    group: "find",
    items: [
      { index: 0, source: "cvr" }, // instant CVR search
      { index: 2, source: "ai" }, // natural-language search
      { index: 6, source: "app" }, // saved companies & searches
    ],
  },
  {
    group: "understand",
    items: [
      { index: 1, source: "ai" }, // company briefings
      { index: 7, source: "ai" }, // enrichment
    ],
  },
  {
    group: "act",
    items: [
      { index: 3, source: "ai" }, // outreach drafts
      { index: 8, source: "ai" }, // todo suggestions
    ],
  },
  {
    group: "watch",
    items: [
      { index: 4, source: "cvr" }, // lead triggers
      { index: 5, source: "cvr" }, // real-time notifications
    ],
  },
];

/* Tabs are cut at four positions across the drawer, as they would be
   on real dividers. Percentages, so they hold at any width. */
const TAB_OFFSET = ["0%", "24%", "48%", "72%"];

const PAPER = "#EEF2F9";
const INK = "#0B1220";

export function FeatureDrawer() {
  const { t } = useLanguage();

  return (
    <div className="feature-drawer relative">
      {/* Drawer walls */}
      <span className="absolute inset-y-0 -left-px hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block" />
      <span className="absolute inset-y-0 -right-px hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block" />

      {FILING.map(({ group, items }, g) => (
        <section key={group} className="drawer-section relative pb-14 last:pb-0">
          {/* Divider tab */}
          <div
            className="relative h-9 sm:h-10"
            style={{ paddingLeft: TAB_OFFSET[g] }}
          >
            <span
              style={{ background: PAPER, color: INK }}
              className="inline-flex h-full items-center gap-3 rounded-t-[3px] px-4 sm:px-5 shadow-[0_-6px_18px_-8px_rgba(0,0,0,0.6)]"
            >
              <span className="font-(family-name:--font-manrope) text-[13px] font-extrabold uppercase tracking-[0.16em]">
                {t.features.groups[group]}
              </span>
              <span
                className="font-mono text-[10px] tabular-nums"
                style={{ color: `${INK}66` }}
              >
                {items.length} {t.features.filed}
              </span>
            </span>
          </div>

          {/* The divider itself */}
          <div className="drawer-rule h-px w-full bg-white/20" />

          {/* Cards filed behind it */}
          <ul>
            {items.map(({ index, source }) => {
              const item = t.features.items[index];
              return (
                <li
                  key={index}
                  className="drawer-row group grid grid-cols-[3.5rem_1fr] gap-x-4 gap-y-1 border-b border-white/8 py-6 transition-colors hover:bg-white/[0.02] sm:grid-cols-[5rem_1fr] sm:gap-x-7"
                >
                  <span
                    className={`mt-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
                      source === "ai" ? "text-cyan-400" : "text-slate-500"
                    }`}
                  >
                    {t.features.sources[source]}
                  </span>
                  <div>
                    <h3 className="font-(family-name:--font-manrope) text-lg font-bold tracking-tight text-white sm:text-xl">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.7] text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
