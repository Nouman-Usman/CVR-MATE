import "server-only";

/** TTLs in seconds for each cache category */
export const CACHE_TTL = {
  search: 300,     // 5 minutes
  company: 3600,   // 1 hour
  suggest: 600,    // 10 minutes
  recent: 300,     // 5 minutes
} as const;

/** Build a deterministic cache key from a path and sorted params */
function hashParams(path: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return path;
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${path}?${sorted}`;
}

export const cacheKey = {
  search: (params: Record<string, string>) =>
    `search:${hashParams("company", params)}`,

  company: (vat: number | string) => `company:${vat}`,

  suggest: (query: string) =>
    `suggest:${query.toLowerCase().trim()}`,

  recent: (days: number) => `recent:${days}`,
};
