"use client";

import { Building2, Loader2 } from "lucide-react";

import { useWorkspaces, useSwitchWorkspace } from "@/lib/hooks/use-workspace";
import { useLanguage } from "@/lib/i18n/language-context";

/**
 * What an org-only page shows when the personal workspace is active.
 *
 * Quotes, deals, contacts and the rest carry a NOT NULL organization id — they
 * cannot exist outside an organization. Landing on one from Personal used to
 * produce "Couldn't load pipeline · CRM features require an active
 * organization": a failure notice for something that is not a failure, and with
 * nothing the reader could do about it.
 *
 * The nav hides these pages in Personal, so this is for the paths that skip it —
 * a bookmark, a shared link, a notification.
 */
export default function RequiresOrganization({ feature }: { feature: string }) {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { organizations, hasOrganizations } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();

  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-muted">
        <Building2 className="size-5 text-muted-foreground" />
      </div>

      <p className="text-base font-semibold text-foreground">
        {tr(`${feature} hører til en organisation`, `${feature} lives in an organization`)}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        {hasOrganizations
          ? tr(
              "Du er i dit personlige workspace. Skift til en organisation for at fortsætte.",
              "You are in your personal workspace. Switch to an organization to continue."
            )
          : tr(
              "Opret eller bliv medlem af en organisation for at bruge CRM-funktionerne.",
              "Create or join an organization to use the CRM features."
            )}
      </p>

      {hasOrganizations && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => switchWorkspace.mutate(org.id)}
              disabled={switchWorkspace.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60 cursor-pointer"
            >
              {switchWorkspace.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Building2 className="size-4" />
              )}
              {tr(`Skift til ${org.name}`, `Switch to ${org.name}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
