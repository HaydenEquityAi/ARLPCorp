import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function callClaude(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return "";
  return textBlock.text;
}

export async function callClaudeJSON<T>(
  systemPrompt: string,
  userMessage: string
): Promise<T> {
  const text = await callClaude(systemPrompt, userMessage);

  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Retry once on JSON parse failure
    const retryText = await callClaude(
      systemPrompt +
        "\n\nCRITICAL: Your previous response was not valid JSON. Return ONLY valid JSON, no markdown fences, no explanation.",
      userMessage
    );
    const retryCleaned = retryText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(retryCleaned) as T;
  }
}
