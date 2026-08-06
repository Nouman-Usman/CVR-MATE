import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";

// ─── Rate limiting for invite pages (prevents invitation ID enumeration) ────

const INVITE_RATE_LIMIT = 10; // requests per window
const INVITE_RATE_WINDOW_MS = 60_000; // 1 minute
const inviteRateMap = new Map<string, { count: number; resetAt: number }>();

function checkInviteRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = inviteRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    inviteRateMap.set(ip, { count: 1, resetAt: now + INVITE_RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= INVITE_RATE_LIMIT;
}

// Periodic cleanup to prevent memory leak (runs every ~100 requests)
let cleanupCounter = 0;
function maybeCleanupRateMap() {
  if (++cleanupCounter < 100) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, val] of inviteRateMap) {
    if (now > val.resetAt) inviteRateMap.delete(key);
  }
}

const PROTECTED_ROUTES = [
  "/dashboard",
  "/matches",
  "/agent",
  "/search",
  "/recent-companies",
  "/triggers",
  "/saved",
  "/saved-searches",
  "/exports",
  "/settings",
  "/company",
  "/todos",
  "/pipeline",
  "/prospects",
  "/records",
  "/import",
  "/interactions",
  "/reports",
  "/history",
  "/quotes",
  "/orders",
  "/products",
  "/onboarding",
];

const AUTH_ROUTES = ["/login", "/signup"];

// better-auth uses these cookie names by default
const SESSION_COOKIE = "better-auth.session_token";
const SECURE_SESSION_COOKIE = "__Secure-better-auth.session_token";

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIE) || req.cookies.has(SECURE_SESSION_COOKIE);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoggedIn = hasSessionCookie(req);

  // ─── Chat-first landing: serve the chat funnel on its own hostname ─────────
  // The chat page lives at /start. On its dedicated host(s) — a domain attached
  // to THIS Vercel project (e.g. start.cvr-mate.dk) — rewrite only PAGE requests
  // to /start; APIs, _next assets, and files must resolve unchanged, or the page
  // loads but its scripts/auth calls 404. CHAT_LANDING_HOSTNAME may be a
  // comma-separated list so a .vercel.app alias and a custom domain both work.
  const chatHosts = (
    process.env.CHAT_LANDING_HOSTNAME ||
    process.env.NEXT_PUBLIC_CHAT_LANDING_HOSTNAME ||
    "start.cvr-mate.dk"
  )
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();

  if (chatHosts.includes(host)) {
    const isAssetOrApi =
      pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".");
    if (!isAssetOrApi && !pathname.startsWith("/start")) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === "/" ? "/start" : `/start${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Rate limit /invite/* and /api/team/invitations/*/details to prevent enumeration
  if (pathname.startsWith("/invite/") || pathname.includes("/invitations/") && pathname.includes("/details")) {
    maybeCleanupRateMap();
    const ip = getClientIp(req);
    if (!checkInviteRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  // Admin routes (independent of Better Auth): check admin-session cookie
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const hasAdminCookie = req.cookies.has("admin-session");
    if (!hasAdminCookie) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  }

  // Authenticated users trying to access login/signup → redirect to dashboard
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Unauthenticated users trying to access protected routes → redirect to login
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/matches/:path*",
    "/agent/:path*",
    "/search/:path*",
    "/recent-companies/:path*",
    "/triggers/:path*",
    "/saved/:path*",
    "/saved-searches/:path*",
    "/exports/:path*",
    "/settings/:path*",
    "/company/:path*",
    "/todos/:path*",
    "/pipeline/:path*",
    "/prospects/:path*",
    "/records/:path*",
    "/import/:path*",
    "/interactions/:path*",
    "/reports/:path*",
    "/history/:path*",
    "/quotes/:path*",
    "/orders/:path*",
    "/products/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/invite/:path*",
    "/api/team/invitations/:path*/details",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
