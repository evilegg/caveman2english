import type { Rule } from "../types.js";

// Restore implied conjunctions between consecutive short sentences.
// Caveman strips "Also," / "Additionally," / "However," from sentence starts.
// We re-inject them when a sentence appears to continue the same topic as the previous.
//
// Heuristic: if a sentence starts with the same subject noun as the prior sentence,
// or starts with a pronoun (It, This, That, They, These, Those), prepend "Also, ".

const CONTINUATION_STARTERS =
  /^(It|This|That|They|These|Those|The same|Another|Each|Every|All)\b/i;

// Sentence splitter that preserves delimiters.
function splitWithDelimiters(text: string): string[] {
  return text.split(/(?<=\.[ \n])/);
}

function restoreConjunctions(text: string): string {
  const parts = splitWithDelimiters(text);
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0) {
      result.push(part);
      continue;
    }
    const trimmed = part.trimStart();
    if (CONTINUATION_STARTERS.test(trimmed)) {
      // Only add "Also, " if it doesn't already start with a conjunction.
      const alreadyHasConjunction = /^(Also|Additionally|Furthermore|However|But|And|So)\b/i.test(
        trimmed,
      );
      if (!alreadyHasConjunction) {
        result.push(part.replace(/^\s*(\S)/, (_, c: string) => `Also, ${c.toLowerCase()}`));
        continue;
      }
    }
    result.push(part);
  }
  return result.join("");
}

export const conjunctionsRule: Rule = {
  name: "conjunctions",
  apply: restoreConjunctions,
};
