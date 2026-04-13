import type { LlmBackend } from "./base.js";
import { EXPAND_SYSTEM_PROMPT } from "./base.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export class ClaudeBackend implements LlmBackend {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "claude-haiku-4-5-20251001") {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for --backend claude");
    this.apiKey = apiKey;
    this.model = model;
  }

  async expand(text: string): Promise<string> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: EXPAND_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API request failed: ${response.status} — ${err}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    if (data.error) throw new Error(`Claude API error: ${data.error.message}`);

    const textBlock = data.content?.find((b) => b.type === "text");
    return textBlock?.text?.trim() ?? text;
  }
}
