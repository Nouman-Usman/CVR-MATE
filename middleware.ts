import { NextRequest, NextResponse } from "next/server";

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
];

const AUTH_ROUTES = ["/login", "/signup"];

// better-auth uses this cookie name by default
const SESSION_COOKIE = "better-auth.session_token";

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIE);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoggedIn = hasSessionCookie(req);

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
    "/login",
    "/signup",
  ],
};
