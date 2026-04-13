import type { Rule } from "../types.js";

// Expand arrow notation used in caveman Ultra mode:
//   X → Y        →  X, which leads to Y
//   X→Y          →  X, which leads to Y
// Arrows inside code spans/blocks are preserved by the caller (code fence stripping).
const ARROW_PHRASE: Record<string, string> = {
  "→": "which leads to",
  "->": "which leads to",
  "=>": "which results in",
};

function expandArrows(text: string): string {
  // Replace arrows that are surrounded by non-code content.
  // Handles optional surrounding spaces.
  return text.replace(
    /([^\n`]+?)\s*(→|->|=>)\s*([^\n`]+)/g,
    (_, left: string, arrow: string, right: string) => {
      const phrase = ARROW_PHRASE[arrow] ?? "which leads to";
      const l = left.trimEnd();
      const r = right.trimStart();
      // If left side ends with punctuation already, start fresh sentence.
      if (/[.!?:]$/.test(l)) {
        return `${l} This ${phrase} ${r}`;
      }
      return `${l}, ${phrase} ${r}`;
    },
  );
}

export const arrowsRule: Rule = {
  name: "arrows",
  apply: expandArrows,
};
