export type BackendName = "none" | "ollama" | "claude";

export interface ExpandOptions {
  backend: BackendName;
  model?: string;
  ollamaUrl?: string;
  expand: boolean;
  expandThreshold: number;
}

export interface Rule {
  name: string;
  apply(text: string): string;
}
