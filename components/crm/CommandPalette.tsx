"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  User,
  FileText,
  ShoppingCart,
  KanbanSquare,
  CornerDownLeft,
} from "lucide-react";
import { useTr } from "@/lib/i18n/tr";
import { fetchJson } from "@/lib/api/fetch-json";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/hooks/query-keys";
import { formatOre } from "@/lib/format";
import { inputClass } from "@/components/ui/input";

interface CompanyHit {
  vat: string;
  name: string;
  city: string | null;
  status: string | null;
  saved: boolean;
}
interface ContactHit {
  id: string;
  name: string;
  title: string | null;
  companyVat: string;
  companyName: string;
}
interface DocumentHit {
  kind: "quote" | "order";
  id: string;
  number: string;
  status: string;
  total: number;
  companyVat: string;
  companyName: string;
}
interface DealHit {
  id: string;
  title: string;
  amount: number | null;
  companyVat: string;
  companyName: string;
}
interface SearchResponse {
  query: string;
  mode: string;
  companies: CompanyHit[];
  contacts: ContactHit[];
  documents?: DocumentHit[];
  deals?: DealHit[];
}

/** One selectable row, flattened across groups so arrow keys cross boundaries. */
interface Row {
  key: string;
  group: string;
  icon: typeof Building2;
  title: string;
  subtitle: string;
  href: string;
}

// ── Open/close as an external store ─────────────────────────────────────────
// The shortcut has to work from any page, and the palette is mounted once in
// the layout. A module-level store lets the global key handler and the
// component share state without threading a context through every page.
let paletteOpen = false;
const paletteListeners = new Set<() => void>();

function setPaletteOpen(next: boolean) {
  if (paletteOpen === next) return;
  paletteOpen = next;
  for (const l of paletteListeners) l();
}

function subscribeToPalette(onChange: () => void) {
  paletteListeners.add(onChange);
  return () => {
    paletteListeners.delete(onChange);
  };
}

const readPaletteOpen = () => paletteOpen;
const paletteClosedOnServer = () => false;

/** Opens the palette from anywhere (e.g. a toolbar button). */
export function openCommandPalette() {
  setPaletteOpen(true);
}

/**
 * Owns only the shortcut and the open flag.
 *
 * The dialog is a separate component so that closing unmounts it: the query,
 * debounce and highlight then die with it, and the next ⌘K starts clean without
 * an effect that resets three pieces of state.
 */
export function CommandPalette() {
  const open = useSyncExternalStore(subscribeToPalette, readPaletteOpen, paletteClosedOnServer);

  // ⌘K / Ctrl+K anywhere. Registered once for the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return <PaletteDialog />;
}

function PaletteDialog() {
  const { tr, locale } = useTr();
  const router = useRouter();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeRaw, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: qk.recordsSearch(debounced),
    queryFn: () => fetchJson(`/api/records/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const rows: Row[] = [];
  for (const c of data?.companies ?? []) {
    rows.push({
      key: `company:${c.vat}`,
      group: tr("Virksomheder", "Companies"),
      icon: Building2,
      title: c.name,
      subtitle: [`CVR ${c.vat}`, c.city, c.status].filter(Boolean).join(" · "),
      href: `/company/${c.vat}`,
    });
  }
  for (const d of data?.documents ?? []) {
    rows.push({
      key: `${d.kind}:${d.id}`,
      group: tr("Dokumenter", "Documents"),
      icon: d.kind === "quote" ? FileText : ShoppingCart,
      title: `${d.number} · ${d.companyName}`,
      subtitle: `${d.status} · ${formatOre(d.total, locale)}`,
      href: d.kind === "quote" ? `/quotes/${d.id}` : `/orders/${d.id}`,
    });
  }
  for (const c of data?.contacts ?? []) {
    rows.push({
      key: `contact:${c.id}`,
      group: tr("Kontakter", "Contacts"),
      icon: User,
      title: c.name,
      // Contacts have no page of their own; the company profile is where they
      // live, so that is where selecting one goes.
      subtitle: [c.title, c.companyName].filter(Boolean).join(" · "),
      href: `/company/${c.companyVat}`,
    });
  }
  for (const d of data?.deals ?? []) {
    rows.push({
      key: `deal:${d.id}`,
      group: tr("Handler", "Deals"),
      icon: KanbanSquare,
      title: d.title,
      subtitle: [d.companyName, d.amount != null ? formatOre(d.amount, locale) : null]
        .filter(Boolean)
        .join(" · "),
      href: `/pipeline`,
    });
  }

  // Derived, not stored: the result set changes under the highlight on every
  // keystroke, and an index kept in state would point at a stale row.
  const active = activeRaw < rows.length ? activeRaw : 0;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current
      .querySelector(`#${CSS.escape(`${baseId}-opt-${active}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, baseId]);

  function go(row: Row) {
    setPaletteOpen(false);
    router.push(row.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setPaletteOpen(false);
      return;
    }
    if (!rows.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) go(row);
    }
  }

  const showEmpty = debounced.length >= 2 && !isFetching && rows.length === 0;
  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] bg-black/40 backdrop-blur-[2px]"
      // Clicking the backdrop dismisses; the panel stops propagation below.
      onMouseDown={() => setPaletteOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("Søg", "Search")}
        className="w-full max-w-xl rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-border">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={rows.length > 0 ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={rows.length > 0 ? `${baseId}-opt-${active}` : undefined}
            autoComplete="off"
            aria-label={tr("Søg i virksomheder, kontakter og dokumenter", "Search companies, contacts and documents")}
            className={inputClass + " h-12 rounded-none border-0 pl-11 pr-4 text-base focus-visible:ring-0"}
            placeholder={tr(
              "Søg virksomhed, kontakt, tilbudsnummer…",
              "Search company, contact, quote number…"
            )}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        <span aria-live="polite" className="sr-only">
          {isFetching
            ? tr("Søger…", "Searching…")
            : debounced.length >= 2
              ? tr(`${rows.length} resultater`, `${rows.length} results`)
              : ""}
        </span>

        <div className="max-h-[60vh] overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              {tr("Skriv mindst 2 tegn.", "Type at least 2 characters.")}
            </p>
          ) : showEmpty ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              {tr("Ingen resultater i dine egne data.", "No results in your own records.")}
            </p>
          ) : (
            <ul ref={listRef} id={listboxId} role="listbox" aria-label={tr("Resultater", "Results")}>
              {rows.map((row, i) => {
                const Icon = row.icon;
                const newGroup = row.group !== lastGroup;
                lastGroup = row.group;
                return (
                  <li key={row.key}>
                    {newGroup && (
                      <p
                        // Presentational: a heading inside a listbox would be
                        // announced as an option by some screen readers.
                        role="presentation"
                        className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                      >
                        {row.group}
                      </p>
                    )}
                    <div
                      id={`${baseId}-opt-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        go(row);
                      }}
                      className={
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer " +
                        (i === active ? "bg-muted" : "")
                      }
                    >
                      <Icon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{row.title}</p>
                        {row.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{row.subtitle}</p>
                        )}
                      </div>
                      {i === active && (
                        <CornerDownLeft className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>↑↓ {tr("naviger", "navigate")}</span>
          <span>↵ {tr("åbn", "open")}</span>
          <span>esc {tr("luk", "close")}</span>
          <span className="ml-auto">
            {tr("Søger kun i egne data", "Searches your own records only")}
          </span>
        </div>
      </div>
    </div>
  );
}
