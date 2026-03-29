import "server-only";

/** TTLs in seconds for each cache category */
export const CACHE_TTL = {
  search: 300,     // 5 minutes
  company: 3600,   // 1 hour
  suggest: 600,    // 10 minutes
  participant: 3600, // 1 hour
  recent: 14400,   // 4 hours (key is date-scoped, refreshes daily)
  aiBriefing: 86400,  // 24 hours
  aiOutreach: 3600,   // 1 hour
  aiPipeline: 1800,   // 30 minutes
  todos: 120,          // 2 minutes
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

  participant: (id: number | string) => `participant:${id}`,

  recent: (days: number) => {
    const today = new Date().toISOString().split("T")[0];
    return `recent:${days}:${today}`;
  },

  aiBriefing: (vat: string, locale: string) => `ai:briefing:${vat}:${locale}`,
  aiOutreach: (vat: string, type: string, tone: string) =>
    `ai:outreach:${vat}:${type}:${tone}`,
  aiPipeline: (userId: string) => `ai:pipeline:${userId}`,
  todos: (userId: string) => `todos:${userId}`,
};
