import * as React from "react";

import { sendEmail } from "../mailer";
import { AnnualReportDigestEmail } from "../templates/annual-report-digest";
import type { AnnualReportDigestData } from "../types";

interface Args {
  to: string;
  userName: string;
  userId: string;
  data: AnnualReportDigestData;
  language?: "en" | "da";
}

/**
 * Send the daily annual-report digest.
 *
 * The subject names the count rather than a company, because the digest is
 * one-per-day by design — during the April–June filing season it routinely
 * covers several companies at once.
 */
export async function sendAnnualReportDigestEmail({
  to,
  userName,
  userId,
  data,
  language = "da",
}: Args) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.dk";
  const n = data.reportCount;

  const subject =
    language === "da"
      ? n === 1
        ? "1 fulgt virksomhed har indleveret årsrapport"
        : `${n} fulgte virksomheder har indleveret årsrapport`
      : n === 1
        ? "1 followed company filed an annual report"
        : `${n} followed companies filed annual reports`;

  return sendEmail(
    React.createElement(AnnualReportDigestEmail, { userName, baseUrl, data, language }),
    { to, subject, templateId: "annual_report_digest", userId }
  );
}
