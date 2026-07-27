export interface ChatTurnResult {
  assistantMessage: string;
  extractedFields: {
    teamSize?: "solo" | "small" | "medium" | "large";
    monthlyProspectingVolume?: "low" | "medium" | "high";
    useCase?: string;
  };
  /**
   * 2–3 short answers the visitor could tap instead of typing, written in
   * their own first-person voice. Empty once readyToRecommend is true.
   */
  suggestedReplies: string[];
  readyToRecommend: boolean;
}

export const CHAT_LANDING_SYSTEM_PROMPT = `You are the CVR-MATE assistant on a chat-first landing page for Danish B2B lead intelligence. A visitor is describing their business or a target company. Your job:

1. Ask ONE qualifying question at a time (never more than one question per reply).
2. Ask at most 5 questions total across the whole conversation.
3. Aim to learn: team size (solo/small/medium/large), how many companies they'd prospect per month (low/medium/high), and their use case.
4. Be warm, concise, and conversational — this is the entire landing page experience, not a form.
5. Once you have enough to recommend a plan (or you've asked 5 questions), set readyToRecommend to true and write a short closing message instead of another question.
6. With EACH question, provide 2–3 short suggested answers the visitor could tap instead of typing. Write them in the visitor's own first-person voice (e.g. "Just me", "A team of 2–5", "I sell to manufacturers"). Keep each under 6 words, make them genuinely distinct, and make them plausible real answers — never "Yes"/"No" unless the question is truly yes/no. When readyToRecommend is true, return an empty suggestedReplies array (the recommendation UI takes over).

Respond ONLY as JSON matching this shape:
{
  "assistantMessage": string,
  "extractedFields": { "teamSize"?: "solo"|"small"|"medium"|"large", "monthlyProspectingVolume"?: "low"|"medium"|"high", "useCase"?: string },
  "suggestedReplies": string[],
  "readyToRecommend": boolean
}`;

/**
 * The system prompt with a language directive appended. The visitor picks a
 * language on the page; the AI must answer (and phrase its tappable replies) in
 * that language so the conversation actually works for them.
 */
export function chatLandingSystemPrompt(locale: "da" | "en"): string {
  const directive = locale === "da"
    ? "Write assistantMessage and every suggestedReplies entry in Danish (dansk). Keep the JSON keys and enum values exactly as specified in English."
    : "Write assistantMessage and every suggestedReplies entry in English.";
  return `${CHAT_LANDING_SYSTEM_PROMPT}\n\n7. ${directive}`;
}

/** Serializes a transcript into a single prompt string — generateAiJson takes one userPrompt, not a message array. */
export function buildChatTurnPrompt(transcript: { role: "user" | "assistant"; content: string }[]): string {
  const lines = transcript.map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`);
  return `Conversation so far:\n${lines.join("\n")}\n\nRespond with your next message as the assistant, following the JSON shape from your system prompt.`;
}
