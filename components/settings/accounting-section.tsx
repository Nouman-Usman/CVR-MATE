"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";

import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import type { SettingsChoice } from "@/lib/accounting/types";
import {
  useAccountingConnection,
  useConnectAccounting,
  useDisconnectAccounting,
  useRediscoverSettings,
  useUpdateAccountingSettings,
} from "@/lib/hooks/use-accounting";

const PROVIDER = "economic";

/**
 * Connecting the organization's bookkeeping system.
 *
 * Two things this screen is deliberate about:
 *
 *   • It never suggests CVR-MATE will send the invoice. The wording throughout
 *     is "draft" — booking allocates a legal invoice number and is undone only
 *     by a credit note, so that step stays in e-conomic.
 *   • It shows what auto-configuration guessed. The VAT zone in particular
 *     decides what every customer is charged; a silently wrong pick would be
 *     discovered at the end of a quarter.
 */
export function AccountingSection() {
  const { tr } = useTr();
  const errorMessage = useApiErrorMessage();

  const { data, isPending, isError } = useAccountingConnection();
  const connect = useConnectAccounting();
  const disconnect = useDisconnectAccounting(PROVIDER);
  const rediscover = useRediscoverSettings(PROVIDER);
  const update = useUpdateAccountingSettings(PROVIDER);

  const [token, setToken] = useState("");
  const [choices, setChoices] = useState<SettingsChoice[] | null>(null);
  const [pendingReview, setPendingReview] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  /**
   * Report the outcome of the redirect flow.
   *
   * The grant flow leaves the browser on `/settings?tab=integrations&...`, so
   * the result arrives as query parameters rather than as a mutation response.
   * They are stripped afterwards so a refresh does not replay the toast — and,
   * more importantly, so nothing from the redirect lingers in the address bar.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;

    if (connected === "economic") {
      const needsReview = params.get("review") === "1";
      toast.success(
        needsReview
          ? tr("Forbundet — tjek opsætningen", "Connected — review the setup")
          : tr("Forbundet til e-conomic", "Connected to e-conomic")
      );
      // Something was guessed; open the panel rather than leaving it to be found.
      if (needsReview) setPendingReview(true);
    } else if (error) {
      toast.error(GRANT_ERRORS[error]?.(tr) ?? tr("Forbindelsen mislykkedes", "Connection failed"));
    }

    for (const key of ["connected", "review", "error", "reason"]) params.delete(key);
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`
    );
  }, [tr]);

  // Deliberately not inside the redirect effect: the connection has to be
  // loaded first, and rediscover needs a stored connection to read from.
  useEffect(() => {
    if (!pendingReview || !data?.connection || choices) return;
    setPendingReview(false);
    rediscover.mutate(undefined, {
      onSuccess: (r) => applyChoices(r.choices),
      onError: () => undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReview, data?.connection]);

  // A 403 means no organization or no Enterprise plan — the CRM gate already
  // explains that elsewhere, so say nothing here rather than twice.
  if (isPending || isError) return null;

  const connection = data?.connection ?? null;

  function applyChoices(next: SettingsChoice[]) {
    setChoices(next);
    setDraft(
      Object.fromEntries(next.map((c) => [c.key, c.selectedValue ?? ""])) as Record<string, string>
    );
  }

  if (!connection) {
    return (
      <Card>
        <Header
          title={tr("Bogføringssystem", "Bookkeeping system")}
          subtitle={tr(
            "Send opfyldte ordrer til e-conomic som fakturaudkast. Du bogfører og sender selv.",
            "Send fulfilled orders to e-conomic as draft invoices. You book and send them yourself."
          )}
        />

        {/* The normal path: e-conomic asks the user to approve CVR-MATE against
            their agreement and hands the token back to us. Nothing is typed. */}
        <a
          href="/api/accounting/economic/start"
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          <Plug className="size-4" />
          {tr("Forbind med e-conomic", "Connect with e-conomic")}
        </a>
        <p className="text-[11px] text-slate-500">
          {tr(
            "Du bliver sendt til e-conomic for at godkende adgangen. Adgangen kan tilbagekaldes i e-conomic når som helst.",
            "You will be sent to e-conomic to approve access. It can be revoked in e-conomic at any time."
          )}
        </p>

        {/* Kept as a fallback for support and for agreements where the redirect
            cannot be used — deliberately not the first thing offered. */}
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            {tr("Indsæt token manuelt", "Paste a token manually")}
          </summary>
          <div className="mt-3 space-y-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={tr("Aftale-token fra e-conomic", "Agreement grant token from e-conomic")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              autoComplete="off"
            />
            <button
              onClick={() =>
                connect.mutate(
                  { provider: PROVIDER, accessToken: token.trim() },
                  {
                    onSuccess: (r) => {
                      setToken("");
                      applyChoices(r.choices);
                      toast.success(
                        r.needsReview
                          ? tr("Forbundet — tjek opsætningen", "Connected — review the setup")
                          : tr("Forbundet til e-conomic", "Connected to e-conomic")
                      );
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  }
                )
              }
              disabled={!token.trim() || connect.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {connect.isPending && <Loader2 className="size-3 animate-spin" />}
              {tr("Forbind med token", "Connect with token")}
            </button>
          </div>
        </details>
      </Card>
    );
  }

  return (
    <Card>
      <Header
        title={tr("Bogføringssystem", "Bookkeeping system")}
        subtitle={connection.agreementName ?? "e-conomic"}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <Check className="size-3" />
          {tr("Forbundet", "Connected")}
        </span>
        {connection.lastError && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="size-3" />
            {tr("Seneste synk fejlede", "Last sync failed")}
          </span>
        )}
      </div>

      {connection.lastError && (
        // A broken integration that looks fine is worse than one that says so.
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {connection.lastError}
        </p>
      )}

      {choices && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {tr("Opsætning fra din aftale", "Configuration from your agreement")}
          </p>
          {choices.map((c) => (
            <label key={c.key} className="block space-y-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                {LABELS[c.key]?.(tr) ?? c.key}
                {!c.confident && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    <AlertTriangle className="size-2.5" />
                    {tr("gættet", "guessed")}
                  </span>
                )}
              </span>
              <select
                value={draft[c.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">{tr("— vælg —", "— choose —")}</option>
                {c.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            onClick={() =>
              update.mutate(coerce(draft), {
                onSuccess: () => toast.success(tr("Opsætning gemt", "Configuration saved")),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
            disabled={update.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending && <Loader2 className="size-3 animate-spin" />}
            {tr("Gem opsætning", "Save configuration")}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            rediscover.mutate(undefined, {
              onSuccess: (r) => {
                applyChoices(r.choices);
                if (r.needsReview) {
                  toast.warning(
                    tr("Nogle valg kunne ikke bestemmes", "Some choices could not be determined")
                  );
                }
              },
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
          disabled={rediscover.isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {rediscover.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {tr("Gennemgå opsætning", "Review configuration")}
        </button>

        <button
          onClick={() =>
            disconnect.mutate(undefined, {
              onSuccess: () => {
                setChoices(null);
                toast.success(tr("Forbindelse fjernet", "Disconnected"));
              },
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
          disabled={disconnect.isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          {disconnect.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Unplug className="size-3.5" />
          )}
          {tr("Afbryd", "Disconnect")}
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        {tr(
          "Fakturaer bliver i e-conomic. Afbrydelse fjerner ikke historikken.",
          "Invoices stay in e-conomic. Disconnecting does not remove the history."
        )}
      </p>
    </Card>
  );
}

/**
 * Numbers back to numbers.
 *
 * `<select>` values are strings, but e-conomic's settings are numeric except
 * for the product number — sending "1" where 1 is expected is the kind of thing
 * that fails only at invoice time.
 */
function coerce(draft: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(draft)) {
    if (v === "") {
      out[k] = null;
      continue;
    }
    out[k] = k === "fallbackProductNumber" ? v : Number(v);
  }
  return out;
}

/** Error codes the grant flow can redirect back with. */
const GRANT_ERRORS: Record<string, (tr: (da: string, en: string) => string) => string> = {
  not_authorized: (tr) => tr("Du har ikke adgang til dette.", "You do not have access to this."),
  forbidden: (tr) =>
    tr("Kun ejer eller admin kan forbinde bogføring.", "Only an owner or admin can connect bookkeeping."),
  rate_limited: (tr) => tr("For mange forsøg. Prøv igen senere.", "Too many attempts. Try again later."),
  economic_not_configured: (tr) =>
    tr("e-conomic er ikke konfigureret på denne installation.", "e-conomic is not configured on this deployment."),
  invalid_state: (tr) =>
    tr("Forbindelsen udløb. Prøv igen.", "The connection attempt expired. Please try again."),
  missing_token: (tr) => tr("e-conomic sendte ingen adgang tilbage.", "e-conomic returned no access."),
  access_denied: (tr) => tr("Adgang blev afvist i e-conomic.", "Access was declined in e-conomic."),
  auth_failed: (tr) => tr("e-conomic afviste adgangen.", "e-conomic rejected the access."),
  connect_failed: (tr) => tr("Forbindelsen mislykkedes.", "Connection failed."),
};

const LABELS: Record<string, (tr: (da: string, en: string) => string) => string> = {
  customerGroupNumber: (tr) => tr("Kundegruppe", "Customer group"),
  vatZoneNumber: (tr) => tr("Momszone", "VAT zone"),
  paymentTermsNumber: (tr) => tr("Betalingsbetingelser", "Payment terms"),
  layoutNumber: (tr) => tr("Fakturalayout", "Invoice layout"),
  fallbackProductNumber: (tr) => tr("Standardvare til frie linjer", "Product for ad-hoc lines"),
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-100/60 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}
