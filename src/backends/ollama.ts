import type { LlmBackend } from "./base.js";
import { EXPAND_SYSTEM_PROMPT } from "./base.js";

export class OllamaBackend implements LlmBackend {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = "http://localhost:11434", model = "llama3.2") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  async expand(text: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          { role: "system", content: EXPAND_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      error?: string;
    };

    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    return data.message?.content?.trim() ?? text;
  }
}
