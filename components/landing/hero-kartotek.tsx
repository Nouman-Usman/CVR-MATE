"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

/* ─── Kartotek ────────────────────────────────────────────────────
   Before the CVR was a database it was a card index — typed cards in
   a drawer, stamped when a company's status changed. The hero is that
   drawer. Click the top card and it lifts off, revealing the next.

   Companies below are fictional samples, not real registry rows.
─────────────────────────────────────────────────────────────────── */

type IndustryKey = "transport" | "software" | "metal";

const CARDS: {
  cvr: string;
  name: string;
  industry: IndustryKey;
  city: string;
  director: string;
  employees: string;
  revenue: string;
  profit: string;
  email: string;
  phone: string;
  isNew: boolean;
}[] = [
  {
    cvr: "41 28 55 07",
    name: "Nordhavn Logistik ApS",
    industry: "transport",
    city: "2100 København Ø",
    director: "Mette Sørensen",
    employees: "24",
    revenue: "18,4 mio. kr.",
    profit: "2,1 mio. kr.",
    email: "kontakt@nordhavn-logistik.example",
    phone: "+45 38 74 21 09",
    isNew: true,
  },
  {
    cvr: "38 12 44 91",
    name: "Techcorp A/S",
    industry: "software",
    city: "8000 Aarhus C",
    director: "Jonas Bech Andersen",
    employees: "62",
    revenue: "91,7 mio. kr.",
    profit: "8,3 mio. kr.",
    email: "salg@techcorp.example",
    phone: "+45 86 12 55 40",
    isNew: false,
  },
  {
    cvr: "27 55 09 63",
    name: "Vestbro Industri A/S",
    industry: "metal",
    city: "6700 Esbjerg",
    director: "Karin Lund Poulsen",
    employees: "148",
    revenue: "240,5 mio. kr.",
    profit: "12,9 mio. kr.",
    email: "info@vestbro-industri.example",
    phone: "+45 75 45 88 12",
    isNew: false,
  },
];

const LIFT_MS = 460;
const AUTO_MS = 6000;

type Card = (typeof CARDS)[number];

/** Card stock, cooled to sit inside the site's navy system rather than
 *  the warm bone of a literal paper card. */
const PAPER = "linear-gradient(#F5F8FC, #E4EAF5)";
const INK = "#0B1220";

/* A physical card reads through its edge, not its fill: a lit top cut,
   a dark bottom cut, a tight contact shadow, then ambient falloff. */
const CARD_EDGE = {
  borderRadius: "3px",
  boxShadow: [
    "inset 0 1px 0 rgba(255,255,255,0.85)",
    "inset 0 -1px 0 rgba(11,18,32,0.16)",
    "0 1px 2px rgba(0,0,0,0.4)",
    "0 16px 34px -14px rgba(0,0,0,0.8)",
  ].join(", "),
} as const;

function CardFace({ card, position }: { card: Card; position: number }) {
  const { t } = useLanguage();
  const c = t.hero.card;

  // Green marks a company worth acting on now; graphite marks one already on file.
  const stampColor = card.isNew ? "#0E7A57" : "#5A6478";

  return (
    <>
      {/* Provenance — the saved search that pulled this card. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{ color: `${INK}59` }}
          >
            {c.fromTrigger}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold" style={{ color: `${INK}D9` }}>
            {c.triggers[card.industry]}
          </p>
        </div>
        <span
          className="shrink-0 font-mono text-[10px] tabular-nums"
          style={{ color: `${INK}59` }}
        >
          {position} / {CARDS.length}
        </span>
      </div>

      {/* Identity — the public registry fields */}
      <div
        className="mt-4 flex items-start justify-between gap-4 border-t pt-4"
        style={{ borderColor: `${INK}20` }}
      >
        <div className="min-w-0">
          <span
            className="font-mono text-[15px] font-bold tabular-nums tracking-tight"
            style={{ color: `${INK}8C` }}
          >
            {card.cvr}
          </span>
          <h2
            className="mt-1 font-[family-name:var(--font-manrope)] text-xl sm:text-[26px] font-extrabold uppercase leading-[1.05] tracking-tight"
            style={{ color: INK }}
          >
            {card.name}
          </h2>
          <p
            className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: `${INK}73` }}
          >
            {c.industries[card.industry]} · {card.city}
          </p>
        </div>
        {/* Rubber stamp */}
        <span
          className="mt-0.5 shrink-0 -rotate-[7deg] border-[3px] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] opacity-80"
          style={{ borderColor: stampColor, color: stampColor, mixBlendMode: "multiply" }}
        >
          {card.isNew ? c.stampNew : c.stampActive}
        </span>
      </div>

      {/* The fields the product gates — who runs it, how big it is */}
      <dl className="mt-4 grid grid-cols-2 gap-x-5">
        {[
          [c.director, card.director],
          [c.employees, card.employees],
          [c.revenue, card.revenue],
          [c.profit, card.profit],
        ].map(([label, value]) => (
          <div key={label} className="border-b py-2.5" style={{ borderColor: `${INK}12` }}>
            <dt
              className="font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ color: `${INK}66` }}
            >
              {label}
            </dt>
            <dd
              className="mt-0.5 truncate text-[14px] font-semibold tabular-nums"
              style={{ color: INK }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* How to reach them — the reason a sales team buys this */}
      <div className="mt-4 space-y-1.5 font-mono text-[11px]" style={{ color: `${INK}B3` }}>
        <p className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden>
            mail
          </span>
          <span className="truncate">{card.email}</span>
        </p>
        <p className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden>
            call
          </span>
          <span className="tabular-nums">{card.phone}</span>
        </p>
      </div>
    </>
  );
}

export function HeroKartotek() {
  const { t } = useLanguage();
  const [cursor, setCursor] = useState(0);
  // The card being lifted off. Held as its own layer so it can animate
  // away while the stack underneath moves forward in the same frame.
  const [lifting, setLifting] = useState<{ card: Card; key: number } | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  // Mirrors cursor so advance() can read it without a state updater —
  // side effects inside an updater run twice under StrictMode.
  const cursorRef = useRef(0);

  const advance = useCallback(() => {
    const i = cursorRef.current;
    cursorRef.current = i + 1;
    setLifting({ card: CARDS[i % CARDS.length], key: i });
    setCursor(i + 1);

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setLifting(null), LIFT_MS);
  }, []);

  // Auto-advance. Keyed on cursor so a click restarts the countdown
  // rather than letting the timer fire on top of the user.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(advance, AUTO_MS);
    return () => window.clearTimeout(id);
  }, [cursor, advance]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const stack = [0, 1, 2].map((depth) => ({
    card: CARDS[(cursor + depth) % CARDS.length],
    depth,
    key: cursor + depth,
  }));

  const cardShell =
    "absolute inset-x-0 top-6 p-6 sm:p-7";

  return (
    <div className="relative h-[500px] sm:h-[540px]">
      {stack.map(({ card, depth, key }) => (
        <article
          key={key}
          onClick={depth === 0 ? advance : undefined}
          style={{
            background: PAPER,
            ...CARD_EDGE,
            transform: `translateY(${depth * 22}px) translateX(${depth * 14}px) rotate(${
              depth === 0 ? -1.4 : depth * 1.6
            }deg)`,
            zIndex: 10 - depth,
          }}
          className={`${cardShell} transition-all duration-500 ease-out ${
            depth === 0 ? "cursor-pointer" : "pointer-events-none"
          }`}
        >
          {depth > 0 && (
            <span
              aria-hidden
              style={{ background: `rgba(11,18,32,${0.34 + depth * 0.2})`, borderRadius: "3px" }}
              className="absolute inset-0 z-10"
            />
          )}

          <CardFace card={card} position={((cursor + depth) % CARDS.length) + 1} />

          {depth === 0 && (
            <button
              type="button"
              onClick={advance}
              style={{ borderColor: `${INK}25` }}
              className="mt-6 flex w-full items-center justify-between border-t pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5A6478] transition-colors hover:text-[#0E7A57] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0E7A57]"
            >
              {t.hero.card.next}
              <span aria-hidden>→</span>
            </button>
          )}
        </article>
      ))}

      {/* The card being lifted off the stack */}
      {lifting && (
        <article
          key={`lift-${lifting.key}`}
          aria-hidden
          style={{ background: PAPER, ...CARD_EDGE }}
          className={`${cardShell} animate-card-lift pointer-events-none z-20`}
        >
          <CardFace card={lifting.card} position={(lifting.key % CARDS.length) + 1} />
          <div
            style={{ borderColor: `${INK}25` }}
            className="mt-6 border-t pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5A6478]"
          >
            {t.hero.card.next}
          </div>
        </article>
      )}

      <p className="absolute inset-x-0 -bottom-1 text-center font-mono text-[10px] tracking-wide text-slate-600">
        {t.hero.card.sample}
      </p>
    </div>
  );
}
