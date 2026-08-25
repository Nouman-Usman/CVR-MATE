"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import RequiresOrganization from "@/components/workspace/requires-organization";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { fetchJson } from "@/lib/api/fetch-json";
import { Field } from "@/components/crm/Field";
import { inputCls } from "@/components/company/crm/shared";
import {
  autoMapColumns,
  IMPORT_FIELDS,
  type ImportField,
} from "@/lib/import/contacts";

const MAX_ROWS = 2000;

interface PreviewRow {
  row: number;
  verdict: "new" | "duplicate" | "duplicate-in-file" | "unknown-company";
  cvr: string;
  companyName: string | null;
  name: string;
  email?: string;
}
interface Summary {
  total: number;
  new: number;
  duplicate: number;
  duplicateInFile: number;
  unknownCompany: number;
  skipped: number;
}
interface ImportResponse {
  committed: boolean;
  imported?: number;
  summary: Summary;
  preview?: PreviewRow[];
  issues: Array<{ row: number; message: string }>;
  failures?: Array<{ row: number; message: string }>;
}

export default function ImportPage() {
  const { tr } = useTr();
  const { isPersonal } = useWorkspaces();
  const apiError = useApiErrorMessage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ImportField | null>>({});
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFilename("");
    setHeaders([]);
    setRecords([]);
    setMapping({});
    setResult(null);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    setFilename(file.name);

    Papa.parse<string[]>(file, {
      // Danish Excel exports are semicolon-delimited; auto-detection handles
      // both without asking the user to know which one they have.
      delimiter: "",
      skipEmptyLines: "greedy",
      complete: (parsed) => {
        const rows = parsed.data.filter((r) => Array.isArray(r));
        if (rows.length < 2) {
          toast.error(tr("Filen har ingen datarækker.", "The file has no data rows."));
          return;
        }
        const [head, ...body] = rows;
        if (body.length > MAX_ROWS) {
          toast.error(
            tr(
              `Filen har ${body.length} rækker. Maks. ${MAX_ROWS} ad gangen.`,
              `The file has ${body.length} rows. Import at most ${MAX_ROWS} at a time.`
            )
          );
          return;
        }
        setHeaders(head);
        setRecords(body);
        setMapping(autoMapColumns(head));
      },
      error: (err) => toast.error(err.message),
    });
  }

  async function run(commit: boolean) {
    setBusy(true);
    try {
      const res = await fetchJson<ImportResponse>("/api/import/contacts", {
        method: "POST",
        body: JSON.stringify({ records, mapping, commit }),
      });
      setResult(res);
      if (commit) {
        toast.success(
          tr(`${res.imported} kontakter importeret.`, `Imported ${res.imported} contacts.`)
        );
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const canPreview = mappedFields.has("cvr") && mappedFields.has("name");
  const committed = result?.committed === true;

  // This page's data is NOT NULL organization-scoped, so in the personal
  // workspace the API refuses it. Returning here — before any data-dependent
  // branch — is what stops a refusal being rendered as "nothing here yet",
  // which reads as a fact about the business rather than about the workspace.
  if (isPersonal) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <RequiresOrganization feature={tr("Import", "Import")} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {tr("Importér kontakter", "Import contacts")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Upload en CSV med CVR-nummer og kontaktnavn. Dubletter springes over.",
                "Upload a CSV with a CVR number and contact name. Duplicates are skipped."
              )}
            </p>
          </div>
        </div>

        {/* Step 1 — file */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            {tr("1 · Vælg fil", "1 · Choose a file")}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 cursor-pointer"
            >
              <Upload className="size-4" />
              {tr("Vælg CSV", "Choose CSV")}
            </button>
            {filename && (
              <span className="text-sm text-muted-foreground">
                {filename} · {records.length} {tr("rækker", "rows")}
              </span>
            )}
          </div>
        </div>

        {/* Step 2 — mapping */}
        {headers.length > 0 && (
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              {tr("2 · Tilknyt kolonner", "2 · Map columns")}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {tr(
                "Kolonnerne er gættet ud fra overskrifterne — ret dem hvis nødvendigt. CVR og navn er påkrævet.",
                "Columns are guessed from the headers — correct them if needed. CVR and name are required."
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {headers.map((header, i) => (
                <Field key={i} label={header || tr(`Kolonne ${i + 1}`, `Column ${i + 1}`)}>
                  <select
                    className={inputCls}
                    value={mapping[i] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [i]: (e.target.value || null) as ImportField | null,
                      }))
                    }
                  >
                    <option value="">{tr("— Ignorér —", "— Ignore —")}</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option
                        key={f}
                        value={f}
                        // A field can only come from one column; offering it
                        // twice would silently drop one of them.
                        disabled={mappedFields.has(f) && mapping[i] !== f}
                      >
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => run(false)}
                disabled={!canPreview || busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {tr("Se gennemgang", "Preview")}
              </button>
              {!canPreview && (
                <span className="text-xs text-destructive">
                  {tr("Tilknyt både CVR og navn.", "Map both CVR and name.")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — preview / result */}
        {result && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {committed ? tr("Resultat", "Result") : tr("3 · Gennemgang", "3 · Preview")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {(
                [
                  ["new", tr("Nye", "New"), result.summary.new],
                  ["duplicate", tr("Dubletter", "Duplicates"), result.summary.duplicate],
                  ["inFile", tr("Dublet i fil", "Repeat in file"), result.summary.duplicateInFile],
                  ["unknown", tr("Ukendt CVR", "Unknown CVR"), result.summary.unknownCompany],
                  ["skipped", tr("Sprunget over", "Skipped"), result.summary.skipped],
                ] as const
              ).map(([key, label, value]) => (
                <div key={key} className="rounded-lg border border-border p-2">
                  <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {committed ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {tr(
                  `${result.imported} kontakter importeret.`,
                  `${result.imported} contacts imported.`
                )}
              </p>
            ) : (
              <>
                {/* Unknown CVRs are not an error — the company is simply not in
                    the local cache yet, and committing resolves it. */}
                {result.summary.unknownCompany > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "Ukendte CVR-numre hentes fra registret under import.",
                      "Unknown CVR numbers are fetched from the registry during import."
                    )}
                  </p>
                )}
                <button
                  onClick={() => run(true)}
                  disabled={busy || result.summary.total === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {tr("Importér", "Import")}
                </button>
              </>
            )}

            {(result.issues.length > 0 || (result.failures?.length ?? 0) > 0) && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
                  <AlertTriangle className="size-3.5" />
                  {tr("Rækker der ikke kunne bruges", "Rows that could not be used")}
                </p>
                <ul className="space-y-0.5 max-h-48 overflow-y-auto">
                  {[...result.issues, ...(result.failures ?? [])].map((issue, i) => (
                    <li key={i} className="text-[11px] text-amber-900 dark:text-amber-200">
                      {tr("Række", "Row")} {issue.row}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!committed && result.preview && result.preview.length > 0 && (
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">#</th>
                      <th className="text-left px-3 py-2 font-semibold">{tr("Navn", "Name")}</th>
                      <th className="text-left px-3 py-2 font-semibold">CVR</th>
                      <th className="text-left px-3 py-2 font-semibold">
                        {tr("Virksomhed", "Company")}
                      </th>
                      <th className="text-left px-3 py-2 font-semibold">
                        {tr("Status", "Status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.preview.slice(0, 100).map((p) => (
                      <tr key={p.row}>
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{p.row}</td>
                        <td className="px-3 py-1.5 text-foreground">{p.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{p.cvr}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {p.companyName ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={
                              p.verdict === "new"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : p.verdict === "unknown-company"
                                  ? "text-muted-foreground"
                                  : "text-amber-700 dark:text-amber-400"
                            }
                          >
                            {p.verdict}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.preview.length > 100 && (
                  // Never let a truncated table read as the whole file.
                  <p className="px-3 py-2 text-[11px] text-muted-foreground">
                    {tr(
                      `Viser de første 100 af ${result.preview.length} rækker.`,
                      `Showing the first 100 of ${result.preview.length} rows.`
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
