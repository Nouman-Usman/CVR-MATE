"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Building2, User, Loader2 } from "lucide-react";

import { useWorkspaces, useSwitchWorkspace } from "@/lib/hooks/use-workspace";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

/**
 * Move between the personal workspace and each organization.
 *
 * This is what makes the isolation usable. Accepting an invitation used to move
 * someone into org context with no way back — personal data stopped matching
 * org-scoped queries and everything they saved afterwards became org property.
 * Being able to see which workspace you are in, and leave it, is the other half
 * of not mixing the data.
 *
 * Hidden entirely for users with no organizations: a switcher offering one
 * choice is just furniture.
 */
export default function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { organizations, activeOrgId, activeOrg, isPersonal, hasOrganizations, isLoading } =
    useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const [open, setOpen] = useState(false);

  if (isLoading || !hasOrganizations) return null;

  const currentLabel = isPersonal ? tr("Personligt", "Personal") : (activeOrg?.name ?? "");

  function select(organizationId: string | null) {
    setOpen(false);
    // Compared against the session, not the resolved org. `activeOrg` is null
    // while the list refetches, which made "switch to Personal" look like a
    // no-op and return early without ever calling the server.
    if (organizationId === activeOrgId) return;
    switchWorkspace.mutate(organizationId);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switchWorkspace.isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={collapsed ? currentLabel : undefined}
        className={cn(
          // Matches the dark sidebar rather than the app's light surfaces.
          "w-full flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.08] disabled:opacity-60 cursor-pointer",
          collapsed && "justify-center px-2"
        )}
      >
        {switchWorkspace.isPending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />
        ) : isPersonal ? (
          <User className="size-4 shrink-0 text-slate-400" />
        ) : (
          <Building2 className="size-4 shrink-0 text-slate-400" />
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left font-medium">{currentLabel}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-slate-500" />
          </>
        )}
      </button>

      {open && !collapsed && (
        <>
          {/* Click-away. Rendered behind the menu so a selection still lands. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-white/[0.08] bg-slate-900 shadow-xl"
          >
            <Option
              icon={<User className="size-4 shrink-0 text-slate-400" />}
              label={tr("Personligt", "Personal")}
              hint={tr("Kun dine egne data", "Only your own data")}
              selected={isPersonal}
              onSelect={() => select(null)}
            />
            <div className="h-px bg-white/[0.08]" />
            {organizations.map((org) => (
              <Option
                key={org.id}
                icon={<Building2 className="size-4 shrink-0 text-slate-400" />}
                label={org.name}
                hint={tr("Delt med teamet", "Shared with the team")}
                selected={activeOrg?.id === org.id}
                onSelect={() => select(org.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Option({
  icon,
  label,
  hint,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06] cursor-pointer"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="block truncate text-[11px] text-slate-500">{hint}</span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-blue-400" />}
    </button>
  );
}
