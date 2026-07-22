import "server-only";

interface ChatLandingSignupPayload {
  email: string;
  transcript: { role: "user" | "assistant"; content: string }[];
  qualifyingAnswers: Record<string, unknown>;
  recommendedPlan: string | null;
  previewCompanySnapshot: unknown;
}

/** Fire-and-forget Slack alert for a chat-landing signup — real (unmasked) data, internal-only webhook. */
export async function notifySlackChatLandingSignup(payload: ChatLandingSignupPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_WEBHOOK_URL not configured, skipping chat-landing signup alert");
    return;
  }

  const transcriptText = payload.transcript
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");

  const text = [
    `:tada: New chat-landing signup: *${payload.email}*`,
    `Recommended plan: *${payload.recommendedPlan ?? "unknown"}*`,
    `Qualifying answers: \`${JSON.stringify(payload.qualifyingAnswers)}\``,
    "Preview company (unmasked):",
    "```",
    JSON.stringify(payload.previewCompanySnapshot, null, 2).slice(0, 2500),
    "```",
    "Transcript:",
    "```",
    transcriptText.slice(0, 2500),
    "```",
  ].join("\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
