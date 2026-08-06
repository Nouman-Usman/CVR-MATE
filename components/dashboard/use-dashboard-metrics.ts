"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_METRIC_IDS,
  MAX_SELECTED,
  METRIC_STORAGE_KEY,
  parseStoredMetrics,
} from "@/lib/dashboard/metrics";

/**
 * The user's chosen dashboard metrics, persisted in localStorage.
 *
 * Read through `useSyncExternalStore` rather than an effect that copies
 * localStorage into state: the server snapshot and the first client render
 * agree, so there is no hydration mismatch and no post-mount flash of the
 * default four cards before the user's real selection appears.
 *
 * Device-local by design. A layout preference does not justify a schema
 * migration, and a server round-trip would put a spinner in front of the very
 * first thing on the page. The trade-off is that the choice does not follow the
 * user to another browser.
 */

const CHANGE_EVENT = "cvr-mate:dashboard-metrics-change";

// Cached so getSnapshot returns a referentially stable array. Returning a fresh
// array each call makes useSyncExternalStore loop forever.
let cachedRaw: string | null = null;
let cachedValue: string[] = DEFAULT_METRIC_IDS;

function readSelection(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(METRIC_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseStoredMetrics(raw) ?? DEFAULT_METRIC_IDS;
  }
  return cachedValue;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // `storage` fires only in *other* tabs, so a change here follows the user
  // across every open tab rather than leaving them inconsistent.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverSnapshot = () => DEFAULT_METRIC_IDS;

export function useDashboardMetrics() {
  const selected = useSyncExternalStore(subscribe, readSelection, serverSnapshot);

  const setSelected = useCallback((ids: string[]) => {
    try {
      window.localStorage.setItem(
        METRIC_STORAGE_KEY,
        JSON.stringify(ids.slice(0, MAX_SELECTED))
      );
    } catch {
      // Private-browsing quota errors must not take the dashboard down; the
      // selection simply does not persist.
    }
    // Write first, then notify — subscribers re-read the store.
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(METRIC_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { selected, setSelected, reset };
}
