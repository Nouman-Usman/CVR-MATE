import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { fiscalYearLabel } from "@/lib/annual-reports/render";
import { formatDKK } from "@/lib/format";
import type { AnnualReportDigestData, AnnualReportDigestReport } from "../types";

interface Props {
  userName: string;
  baseUrl: string;
  data: AnnualReportDigestData;
  language?: "en" | "da";
}

/**
 * The daily annual-report digest.
 *
 * One email covering every followed company that filed today — Danish filing
 * deadlines cluster in April–June, so ten filings in a week must not become
 * ten emails.
 *
 * Renders with or without figures. `summary` is absent on 45% of filings,
 * including Novo Nordisk's, so a missing summary shortens the row rather than
 * removing it.
 */
export function AnnualReportDigestEmail({ userName, baseUrl, data, language = "da" }: Props) {
  const da = language === "da";
  const n = data.reportCount;

  const heading = da
    ? n === 1
      ? "1 virksomhed har indleveret årsrapport"
      : `${n} virksomheder har indleveret årsrapport`
    : n === 1
      ? "1 company filed an annual report"
      : `${n} companies filed annual reports`;

  return (
    <Html>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={intro}>
            {da
              ? `Hej ${userName} — her er dagens nye årsrapporter fra virksomheder du følger.`
              : `Hi ${userName} — here are today's new annual reports from companies you follow.`}
          </Text>

          {data.reports.map((report) => (
            <ReportRow key={`${report.cvr}:${report.periodEnd}`} report={report} da={da} />
          ))}

          <Hr style={hr} />
          <Section style={{ textAlign: "center" }}>
            <Button style={button} href={`${baseUrl}/saved`}>
              {da ? "Se fulgte virksomheder" : "View followed companies"}
            </Button>
          </Section>
          <Text style={footer}>
            {da
              ? "Du modtager denne mail, fordi du følger virksomheder i CVR-MATE. Slå fra under Indstillinger."
              : "You receive this because you follow companies in CVR-MATE. Turn it off in Settings."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function ReportRow({ report, da }: { report: AnnualReportDigestReport; da: boolean }) {
  const locale = da ? "da" : "en";
  const s = report.summary;

  // Only the figures Danish filings actually carry. Revenue is disclosed by
  // 8% of reports and is deliberately not led with.
  const figures = s
    ? [
        { label: da ? "Årets resultat" : "Profit/loss", value: s.profitloss },
        { label: da ? "Egenkapital" : "Equity", value: s.equity },
        { label: da ? "Bruttofortjeneste" : "Gross profit", value: s.grossprofitloss },
      ].filter((f) => f.value != null)
    : [];

  return (
    <Section style={card}>
      <Text style={company}>{report.companyName}</Text>
      <Text style={meta}>
        {da ? "Årsrapport" : "Annual report"} {fiscalYearLabel(report.periodEnd)} · CVR {report.cvr}
      </Text>

      {figures.length > 0 ? (
        <Text style={figuresLine}>
          {figures.map((f) => `${f.label}: ${formatDKK(f.value, locale)}`).join(" · ")}
        </Text>
      ) : (
        <Text style={noFigures}>
          {da
            ? "Regnskabstal er ikke tilgængelige i indberetningen."
            : "Financial figures are not available in the filing data."}
        </Text>
      )}

      {report.documentUrl && (
        <Text style={{ margin: "8px 0 0" }}>
          <Link href={report.documentUrl} style={link}>
            {da ? "Åbn årsrapport (PDF)" : "Open annual report (PDF)"}
          </Link>
        </Text>
      )}
    </Section>
  );
}

const body = { backgroundColor: "#f6f8fb", fontFamily: "-apple-system, Segoe UI, sans-serif" };
const container = { margin: "0 auto", padding: "28px 20px", maxWidth: "600px" };
const h1 = { fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px" };
const intro = { fontSize: "14px", color: "#475569", margin: "0 0 20px" };
const card = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  padding: "16px",
  margin: "0 0 12px",
};
const company = { fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 };
const meta = { fontSize: "12px", color: "#94a3b8", margin: "2px 0 10px" };
const figuresLine = { fontSize: "13px", color: "#1e293b", margin: 0 };
const noFigures = { fontSize: "13px", color: "#94a3b8", fontStyle: "italic" as const, margin: 0 };
const link = { fontSize: "13px", color: "#2563eb", textDecoration: "none" };
const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
const button = {
  backgroundColor: "#0f172a",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "11px 22px",
  borderRadius: "8px",
  textDecoration: "none",
};
const footer = { fontSize: "11px", color: "#94a3b8", textAlign: "center" as const, marginTop: "18px" };
