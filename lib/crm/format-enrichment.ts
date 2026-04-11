import type { CrmNotePayload } from "./types";

// ─── Types (mirror the enrichment interfaces without importing from client hooks) ─

interface CompanyEnrichmentData {
  summary?: string;
  leadScore?: { grade?: string; reason?: string };
  financialHealth?: { status?: string; details?: string };
  buyingSignals?: string[];
  painPoints?: string[];
  competitiveLandscape?: string;
  riskFactors?: string[];
  idealApproach?: { channel?: string; timing?: string; angle?: string };
  keyInsights?: string[];
}

interface PersonEnrichmentData {
  summary?: string;
  roleSignificance?: string;
  networkInfluence?: { score?: string; details?: string };
  careerTrajectory?: { direction?: string; details?: string };
  engagementStrategy?: { approach?: string; topics?: string[]; avoid?: string };
  keyInsights?: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function bulletList(items: string[] | undefined | null): string {
  if (!items?.length) return "";
  return items.map((item) => `• ${item}`).join("\n");
}

function section(title: string, content: string | undefined | null): string {
  if (!content?.trim()) return "";
  return `\n${title}\n${content}\n`;
}

function htmlBulletList(items: string[] | undefined | null): string {
  if (!items?.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function htmlSection(title: string, content: string | undefined | null): string {
  if (!content?.trim()) return "";
  return `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(content)}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MAX_NOTE_LENGTH = 65000; // HubSpot's limit

function truncate(text: string, max: number = MAX_NOTE_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

// ─── Company Enrichment Note ───────────────────────────────────────────────

export function formatCompanyEnrichmentNote(
  enrichment: CompanyEnrichmentData,
  companyName: string,
): CrmNotePayload {
  const date = new Date().toISOString().split("T")[0];

  // Plain text version (fallback)
  const textParts: string[] = [
    `CVR-MATE Intelligence Brief — ${companyName}`,
    `Generated: ${date}`,
    "",
  ];

  if (enrichment.leadScore?.grade) {
    textParts.push(`LEAD SCORE: ${enrichment.leadScore.grade}${enrichment.leadScore.reason ? ` — ${enrichment.leadScore.reason}` : ""}`);
  }
  if (enrichment.financialHealth?.status) {
    textParts.push(`FINANCIAL HEALTH: ${enrichment.financialHealth.status.toUpperCase()}${enrichment.financialHealth.details ? ` — ${enrichment.financialHealth.details}` : ""}`);
  }

  textParts.push(section("EXECUTIVE SUMMARY", enrichment.summary));

  if (enrichment.buyingSignals?.length) {
    textParts.push(`BUYING SIGNALS\n${bulletList(enrichment.buyingSignals)}`);
  }
  if (enrichment.painPoints?.length) {
    textParts.push(`PAIN POINTS\n${bulletList(enrichment.painPoints)}`);
  }

  textParts.push(section("COMPETITIVE LANDSCAPE", enrichment.competitiveLandscape));

  if (enrichment.riskFactors?.length) {
    textParts.push(`RISK FACTORS\n${bulletList(enrichment.riskFactors)}`);
  }

  if (enrichment.idealApproach) {
    const a = enrichment.idealApproach;
    const parts = [
      a.channel ? `Channel: ${a.channel}` : null,
      a.timing ? `Timing: ${a.timing}` : null,
      a.angle ? `Angle: ${a.angle}` : null,
    ].filter(Boolean);
    if (parts.length) {
      textParts.push(`RECOMMENDED APPROACH\n${parts.join(" | ")}`);
    }
  }

  if (enrichment.keyInsights?.length) {
    textParts.push(`KEY INSIGHTS\n${bulletList(enrichment.keyInsights)}`);
  }

  // HTML version (for HubSpot/Pipedrive)
  const htmlParts: string[] = [
    `<h2>CVR-MATE Intelligence Brief — ${escapeHtml(companyName)}</h2>`,
    `<p><em>Generated: ${date}</em></p>`,
  ];

  if (enrichment.leadScore?.grade) {
    htmlParts.push(`<p><strong>Lead Score: ${escapeHtml(enrichment.leadScore.grade)}</strong>${enrichment.leadScore.reason ? ` — ${escapeHtml(enrichment.leadScore.reason)}` : ""}</p>`);
  }
  if (enrichment.financialHealth?.status) {
    htmlParts.push(`<p><strong>Financial Health: ${escapeHtml(enrichment.financialHealth.status)}</strong>${enrichment.financialHealth.details ? ` — ${escapeHtml(enrichment.financialHealth.details)}` : ""}</p>`);
  }

  if (enrichment.summary) htmlParts.push(htmlSection("Executive Summary", enrichment.summary));
  if (enrichment.buyingSignals?.length) {
    htmlParts.push(`<h3>Buying Signals</h3>${htmlBulletList(enrichment.buyingSignals)}`);
  }
  if (enrichment.painPoints?.length) {
    htmlParts.push(`<h3>Pain Points</h3>${htmlBulletList(enrichment.painPoints)}`);
  }
  if (enrichment.competitiveLandscape) htmlParts.push(htmlSection("Competitive Landscape", enrichment.competitiveLandscape));
  if (enrichment.riskFactors?.length) {
    htmlParts.push(`<h3>Risk Factors</h3>${htmlBulletList(enrichment.riskFactors)}`);
  }
  if (enrichment.idealApproach) {
    const a = enrichment.idealApproach;
    const parts = [
      a.channel ? `<strong>Channel:</strong> ${escapeHtml(a.channel)}` : null,
      a.timing ? `<strong>Timing:</strong> ${escapeHtml(a.timing)}` : null,
      a.angle ? `<strong>Angle:</strong> ${escapeHtml(a.angle)}` : null,
    ].filter(Boolean);
    if (parts.length) htmlParts.push(`<h3>Recommended Approach</h3><p>${parts.join(" | ")}</p>`);
  }
  if (enrichment.keyInsights?.length) {
    htmlParts.push(`<h3>Key Insights</h3>${htmlBulletList(enrichment.keyInsights)}`);
  }

  return {
    title: `CVR-MATE Intelligence Brief — ${companyName}`,
    body: truncate(htmlParts.join("\n")),
  };
}

// ─── Person Enrichment Note ────────────────────────────────────────────────

export function formatPersonEnrichmentNote(
  enrichment: PersonEnrichmentData,
  personName: string,
): CrmNotePayload {
  const date = new Date().toISOString().split("T")[0];

  const htmlParts: string[] = [
    `<h2>CVR-MATE Person Brief — ${escapeHtml(personName)}</h2>`,
    `<p><em>Generated: ${date}</em></p>`,
  ];

  if (enrichment.summary) htmlParts.push(htmlSection("Summary", enrichment.summary));
  if (enrichment.roleSignificance) htmlParts.push(htmlSection("Role Significance", enrichment.roleSignificance));

  if (enrichment.networkInfluence?.score) {
    htmlParts.push(`<p><strong>Network Influence: ${escapeHtml(enrichment.networkInfluence.score)}</strong>${enrichment.networkInfluence.details ? ` — ${escapeHtml(enrichment.networkInfluence.details)}` : ""}</p>`);
  }
  if (enrichment.careerTrajectory?.direction) {
    htmlParts.push(`<p><strong>Career Trajectory: ${escapeHtml(enrichment.careerTrajectory.direction)}</strong>${enrichment.careerTrajectory.details ? ` — ${escapeHtml(enrichment.careerTrajectory.details)}` : ""}</p>`);
  }

  if (enrichment.engagementStrategy) {
    const s = enrichment.engagementStrategy;
    const parts: string[] = [];
    if (s.approach) parts.push(`<p><strong>Approach:</strong> ${escapeHtml(s.approach)}</p>`);
    if (s.topics?.length) parts.push(`<p><strong>Topics:</strong> ${s.topics.map(escapeHtml).join(", ")}</p>`);
    if (s.avoid) parts.push(`<p><strong>Avoid:</strong> ${escapeHtml(s.avoid)}</p>`);
    if (parts.length) htmlParts.push(`<h3>Engagement Strategy</h3>${parts.join("")}`);
  }

  if (enrichment.keyInsights?.length) {
    htmlParts.push(`<h3>Key Insights</h3>${htmlBulletList(enrichment.keyInsights)}`);
  }

  return {
    title: `CVR-MATE Person Brief — ${personName}`,
    body: truncate(htmlParts.join("\n")),
  };
}

// ─── User Notes → CRM Note ────────────────────────────────────────────────

export function formatUserNotesAsNote(
  notes: { content: string; createdAt: Date }[],
  companyName: string,
): CrmNotePayload {
  const htmlParts: string[] = [
    `<h2>CVR-MATE Notes — ${escapeHtml(companyName)}</h2>`,
    `<p><em>Synced: ${new Date().toISOString().split("T")[0]}</em></p>`,
  ];

  for (const note of notes) {
    const date = note.createdAt.toISOString().split("T")[0];
    htmlParts.push(`<hr/><p><em>${date}</em></p><p>${escapeHtml(note.content)}</p>`);
  }

  return {
    title: `CVR-MATE Notes — ${companyName}`,
    body: truncate(htmlParts.join("\n")),
  };
}
