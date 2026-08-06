"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useSuggestions } from "@/lib/hooks/use-suggestions";

export interface CompanyOption {
  vat: string;
  name: string;
  city?: string | null;
  /** Overrides the primary line. Used by the synthetic "use this CVR" entry. */
  display?: string;
}

interface Props {
  /** Visible label for the search field. */
  label: string;
  placeholder: string;
  onSelect: (choice: CompanyOption) => void;
  /**
   * Prepends a synthetic entry derived from the raw query — this is how the
   * prospect flow offers "use CVR 12345678" when the user pasted a number
   * rather than a name. Return null to omit it.
   */
  buildExtraOption?: (query: string) => CompanyOption | null;
  /** Suppresses the remote lookup, e.g. when the query is a bare CVR number. */
  skipRemote?: (query: string) => boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  inputClassName?: string;
  loadingLabel: string;
  emptyLabel: string;
  /** Screen-reader announcement for the result count, e.g. `(n) => "3 hits"`. */
  countLabel: (n: number) => string;
}

const MIN_QUERY = 2;

/**
 * Accessible company picker, shared by the quote builder and the prospect
 * form. Both previously rendered a bare input above a stack of `<button>`s:
 * no `role="combobox"`, no `aria-expanded`, no arrow-key navigation, and no
 * announcement when results arrived — a screen-reader user typing a company
 * name got silence, and a keyboard user had to tab through every suggestion
 * to reach the rest of the form.
 *
 * Follows the ARIA 1.2 combobox-with-listbox pattern: focus stays in the
 * input at all times and the active option is pointed at with
 * `aria-activedescendant`, so typing and navigating never fight each other.
 */
export function CompanyCombobox({
  label,
  placeholder,
  onSelect,
  buildExtraOption,
  skipRemote,
  autoFocus,
  invalid,
  inputClassName,
  loadingLabel,
  emptyLabel,
  countLabel,
}: Props) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeRaw, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const skip = skipRemote?.(debounced) ?? false;
  const { data, isFetching } = useSuggestions(skip ? "" : debounced);

  const extra = buildExtraOption?.(debounced) ?? null;
  const remote: CompanyOption[] = skip
    ? []
    : (data?.results ?? []).map((r) => ({
        vat: String(r.vat),
        name: r.life?.name || `CVR ${r.vat}`,
        city: r.address?.cityname,
      }));
  const options = extra ? [extra, ...remote] : remote;

  const hasQuery = debounced.length >= MIN_QUERY || !!extra;
  const open = hasQuery && !dismissed;
  const loading = open && !skip && isFetching;
  const empty = open && !loading && options.length === 0;

  // Results arrive asynchronously, so the stored highlight can outlive the list
  // it pointed into. Clamping here rather than in an effect keeps it a pure
  // function of the current results — no extra render, nothing to resynchronise.
  const active = activeRaw < options.length ? activeRaw : -1;

  // Keep the highlighted option in view — arrow-key navigation is useless if
  // the active row is scrolled out of the 224px-tall listbox.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    listRef.current
      .querySelector(`#${CSS.escape(`${baseId}-opt-${active}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, baseId]);

  function choose(option: CompanyOption) {
    setDismissed(true);
    onSelect(option);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setDismissed(false);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + delta + options.length) % options.length);
      return;
    }
    if (e.key === "Enter" && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active]);
      return;
    }
    if (e.key === "Escape" && open) {
      // Only swallow the key while the list is showing, so Escape still
      // reaches an enclosing dialog once the suggestions are dismissed.
      e.preventDefault();
      setDismissed(true);
      setActive(-1);
    }
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={`${baseId}-input`}
        className="block text-[11px] font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          id={`${baseId}-input`}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${baseId}-opt-${active}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className={(inputClassName ?? "") + " pl-8"}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDismissed(false);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {/* Results arrive asynchronously; without this a screen reader gets no
          signal that anything happened after typing. */}
      <span aria-live="polite" className="sr-only">
        {loading ? loadingLabel : open ? countLabel(options.length) : ""}
      </span>

      {open && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {loading && (
            <p className="text-xs text-muted-foreground text-center py-3">{loadingLabel}</p>
          )}
          {empty && (
            <p className="text-xs text-muted-foreground text-center py-3">{emptyLabel}</p>
          )}
          {options.length > 0 && (
            <ul ref={listRef} id={listboxId} role="listbox" aria-label={label}>
              {options.map((o, i) => (
                <li
                  key={`${o.vat}-${i}`}
                  id={`${baseId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    // Select before the input loses focus.
                    e.preventDefault();
                    choose(o);
                  }}
                  // mousemove, not mouseenter: arrowing through the list
                  // scrolls it under a stationary cursor, which fires
                  // mouseenter on whatever slides beneath and yanks the
                  // highlight back. A parked mouse emits no mousemove, so the
                  // keyboard keeps control until the pointer actually moves.
                  onMouseMove={() => setActive(i)}
                  className={
                    "cursor-pointer px-3 py-2 border-b border-border last:border-b-0 " +
                    (i === active ? "bg-muted" : "")
                  }
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {o.display ?? o.name}
                  </p>
                  {!o.display && (
                    <p className="text-xs text-muted-foreground truncate">
                      CVR {o.vat}
                      {o.city ? ` · ${o.city}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
