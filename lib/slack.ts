import "server-only";

interface ChatLandingSignupPayload {
  email: string;
  transcript: { role: "user" | "assistant"; content: string }[];
  qualifyingAnswers: Record<string, unknown>;
  recommendedPlan: string | null;
  previewCompanySnapshot: unknown;
  ip?: string | null;
}

/** Minimal shape of the fields we surface from an unmasked CVR snapshot. */
interface SnapshotCompany {
  vat?: number;
  life?: { name?: string };
  address?: { zipcode?: number | null; cityname?: string | null };
  industry?: { primary?: { text?: string | null } };
}

const SLACK_TEXT_LIMIT = 2900; // Slack hard-caps a section text block at 3000 chars.

/** camelCase / snake_case → "Title Case" for human-readable field labels. */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Fire-and-forget Slack alert for a chat-landing signup — real (unmasked) data, internal-only webhook. */
export async function notifySlackChatLandingSignup(payload: ChatLandingSignupPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_WEBHOOK_URL not configured, skipping chat-landing signup alert");
    return;
  }

  // ── Qualifying answers → readable bullet lines (was a raw JSON blob) ──
  const answerLines = Object.entries(payload.qualifyingAnswers)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `• *${humanizeKey(k)}:* ${String(v)}`);
  const answersBlock = answerLines.length ? answerLines.join("\n") : "_None captured_";

  // ── Preview companies → one clean line each (was a full nested JSON dump) ──
  const companies = Array.isArray(payload.previewCompanySnapshot)
    ? (payload.previewCompanySnapshot as SnapshotCompany[])
    : [];
  const companyLines = companies.slice(0, 5).map((c) => {
    const name = c.life?.name ?? "Unknown";
    const vat = c.vat ? `CVR ${c.vat}` : "";
    const loc = [c.address?.zipcode, c.address?.cityname].filter(Boolean).join(" ");
    const industry = c.industry?.primary?.text ?? "";
    const meta = [vat, loc, industry].filter(Boolean).join(" · ");
    return `• *${name}*${meta ? `  —  ${meta}` : ""}`;
  });
  const companiesBlock = companyLines.length ? companyLines.join("\n") : "_No preview generated_";

  // ── Transcript → compact "You / CVR-MATE" lines inside one code block ──
  const transcriptText = payload.transcript
    .map((t) => `${t.role === "user" ? "🧑 " : "🤖 "}${t.content}`)
    .join("\n\n");

  const contextLine = [
    `📦 Plan: *${(payload.recommendedPlan ?? "unknown").toUpperCase()}*`,
    payload.ip ? `🌐 ${payload.ip}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🎉 New trial signup", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Email*\n${payload.email}` },
        { type: "mrkdwn", text: `*Plan*\n${(payload.recommendedPlan ?? "unknown").toUpperCase()}` },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: contextLine }] },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Qualifying answers*\n${truncate(answersBlock, SLACK_TEXT_LIMIT)}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Preview companies (unmasked)*\n${truncate(companiesBlock, SLACK_TEXT_LIMIT)}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Transcript*\n${truncate(transcriptText, SLACK_TEXT_LIMIT)}` },
    },
  ];

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `text` is the notification/fallback; `blocks` renders the rich layout.
    body: JSON.stringify({ text: `New trial signup: ${payload.email}`, blocks }),
  });
}
