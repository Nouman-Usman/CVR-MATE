"use client";

import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { label: "Overview", href: "/admin/overview" },
  { label: "Videos", href: "/admin/videos" },
];

const C = {
  bg: "#0a1120",
  border: "#1e2d40",
  text: "#94a3b8",
  active: "#f1f5f9",
  activeBg: "rgba(59,130,246,0.12)",
  activeBorder: "#3b82f6",
  blue: "#3b82f6",
};

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        height: "52px",
        gap: "0",
      }}
    >
      {/* Brand */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: C.blue,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginRight: "32px",
          flexShrink: 0,
        }}
      >
        CVR-MATE Admin
      </span>

      {/* Links */}
      <div style={{ display: "flex", gap: "4px", flex: 1 }}>
        {LINKS.map(({ label, href }) => {
          const active = pathname.startsWith(href);
          return (
            <a
              key={href}
              href={href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                color: active ? C.active : C.text,
                background: active ? C.activeBg : "transparent",
                border: `1px solid ${active ? C.activeBorder : "transparent"}`,
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {label}
            </a>
          );
        })}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          fontSize: "12px",
          color: C.text,
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "6px",
          padding: "5px 12px",
          cursor: "pointer",
          flexShrink: 0,
          transition: "color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = C.text;
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
        }}
      >
        Logout →
      </button>
    </nav>
  );
}
