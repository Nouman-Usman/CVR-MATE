export interface ChatTurnResult {
  assistantMessage: string;
  extractedFields: {
    teamSize?: "solo" | "small" | "medium" | "large";
    monthlyProspectingVolume?: "low" | "medium" | "high";
    useCase?: string;
  };
  readyToRecommend: boolean;
}

export const CHAT_LANDING_SYSTEM_PROMPT = `You are the CVR-MATE assistant on a chat-first landing page for Danish B2B lead intelligence. A visitor is describing their business or a target company. Your job:

1. Ask ONE qualifying question at a time (never more than one question per reply).
2. Ask at most 5 questions total across the whole conversation.
3. Aim to learn: team size (solo/small/medium/large), how many companies they'd prospect per month (low/medium/high), and their use case.
4. Be warm, concise, and conversational — this is the entire landing page experience, not a form.
5. Once you have enough to recommend a plan (or you've asked 5 questions), set readyToRecommend to true and write a short closing message instead of another question.

Respond ONLY as JSON matching this shape:
{
  "assistantMessage": string,
  "extractedFields": { "teamSize"?: "solo"|"small"|"medium"|"large", "monthlyProspectingVolume"?: "low"|"medium"|"high", "useCase"?: string },
  "readyToRecommend": boolean
}`;

/** Serializes a transcript into a single prompt string — generateAiJson takes one userPrompt, not a message array. */
export function buildChatTurnPrompt(transcript: { role: "user" | "assistant"; content: string }[]): string {
  const lines = transcript.map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`);
  return `Conversation so far:\n${lines.join("\n")}\n\nRespond with your next message as the assistant, following the JSON shape from your system prompt.`;
}
