"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard-layout";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  User,
  Lock,
  Bell,
  Globe,
  Building2,
  Palette,
  Users,
  UsersRound,
  CreditCard,
  Plug,
  Key,
  Shield,
  ScrollText,
  Database,
  GitBranch,
} from "lucide-react";

const personalItems = [
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Password", href: "/settings/password", icon: Lock },
  { label: "Notifications", href: "/settings/notifications", icon: Bell },
  { label: "Language", href: "/settings/language", icon: Globe },
];

const orgItems = [
  { label: "General", href: "/settings/org/general", icon: Building2 },
  { label: "Brand", href: "/settings/org/brand", icon: Palette },
  { label: "Members", href: "/settings/org/members", icon: Users },
  { label: "Teams", href: "/settings/org/teams", icon: UsersRound },
  { label: "Billing", href: "/settings/org/billing", icon: CreditCard },
  { label: "Integrations", href: "/settings/org/integrations", icon: Plug },
  { label: "API Keys", href: "/settings/org/api-keys", icon: Key },
  { label: "Security", href: "/settings/org/security", icon: Shield },
  { label: "Audit Log", href: "/settings/org/audit", icon: ScrollText },
  {
    label: "Data & Privacy",
    href: "/settings/org/data-privacy",
    icon: Database,
  },
  { label: "Pipeline", href: "/settings/org/pipeline", icon: GitBranch },
];

function SidebarNavItem({
  item,
  isActive,
}: {
  item: (typeof personalItems)[0];
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/settings/profile" && pathname === "/settings") return true;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <DashboardLayout>
    <div className="mx-auto w-full max-w-7xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Mobile horizontal tab bar */}
      <div className="mb-4 overflow-x-auto lg:hidden">
        <div className="flex gap-1 pb-2">
          {[...personalItems, ...orgItems].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop settings nav */}
        <Card className="hidden w-56 shrink-0 self-start lg:block p-2">
          <div className="space-y-4">
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Personal
              </p>
              <nav className="flex flex-col gap-0.5">
                {personalItems.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    isActive={isActive(item.href)}
                  />
                ))}
              </nav>
            </div>
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Organization
              </p>
              <nav className="flex flex-col gap-0.5">
                {orgItems.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    isActive={isActive(item.href)}
                  />
                ))}
              </nav>
            </div>
          </div>
        </Card>

        {/* Content area */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
    </DashboardLayout>
  );
}
