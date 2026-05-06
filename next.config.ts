import type { NextConfig } from "next";

// ─── Content Security Policy ─────────────────────────────────────────────────
//
// The app uses:
//   • Next.js (inline scripts for hydration — requires 'unsafe-inline' until nonces are wired up)
//   • Stripe.js (js.stripe.com, hooks.stripe.com)
//   • Google OAuth (accounts.google.com)
//   • Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
//   • Supabase Storage (*.supabase.co)
//   • Three.js WebGL (blob: workers)
//
// TODO: Replace 'unsafe-inline' for script-src with nonce-based CSP via
// Next.js middleware + generateBuildId. Eliminates the main XSS vector.

const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
  "worker-src blob: 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Clickjacking — belt-and-suspenders alongside frame-ancestors in CSP
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing attacks
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer data on cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features the app does not use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Enforce HTTPS for 2 years, include subdomains, allow HSTS preload list
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
