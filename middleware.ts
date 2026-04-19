import { NextRequest, NextResponse } from "next/server";

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
  "/search",
  "/recent-companies",
  "/triggers",
  "/saved",
  "/saved-searches",
  "/exports",
  "/settings",
  "/company",
  "/todos",
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

  // Rate limit /invite/* and /api/team/invitations/*/details to prevent enumeration
  if (pathname.startsWith("/invite/") || pathname.includes("/invitations/") && pathname.includes("/details")) {
    maybeCleanupRateMap();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkInviteRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
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
    "/search/:path*",
    "/recent-companies/:path*",
    "/triggers/:path*",
    "/saved/:path*",
    "/saved-searches/:path*",
    "/exports/:path*",
    "/settings/:path*",
    "/company/:path*",
    "/todos/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
    "/invite/:path*",
    "/api/team/invitations/:path*/details",
  ],
};
