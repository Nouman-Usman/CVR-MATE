export const ROUTE_MAP: Record<string, string> = {
  "/search": "search",
  "/triggers": "triggers",
  "/dashboard": "dashboard",
  "/saved": "saved",
  "/saved-searches": "saved-searches",
  "/todos": "todos",
  "/exports": "exports",
  "/settings": "settings",
  "/company": "company",
  "/followed-people": "followed-people",
};

export function routeToFeatureKey(pathname: string): string | null {
  // Exact match first
  if (ROUTE_MAP[pathname]) {
    return ROUTE_MAP[pathname];
  }

  // Dynamic routes: strip params and match prefix
  for (const [route, key] of Object.entries(ROUTE_MAP)) {
    if (pathname.startsWith(route + "/") || pathname === route) {
      return key;
    }
  }

  return null;
}
