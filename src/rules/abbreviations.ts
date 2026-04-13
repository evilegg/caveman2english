import type { Rule } from "../types.js";

// Common technical abbreviations used in caveman output.
// Keys are the abbreviated form (case-insensitive match against word boundaries).
// Values are the expanded form (preserving the original case style of the match
// is attempted for all-caps abbreviations).
const ABBREVS: Record<string, string> = {
  // Infrastructure / general
  DB: "database",
  DBs: "databases",
  env: "environment",
  cfg: "configuration",
  fn: "function",
  fns: "functions",
  arg: "argument",
  args: "arguments",
  param: "parameter",
  params: "parameters",
  prop: "property",
  props: "properties",
  ref: "reference",
  refs: "references",
  repo: "repository",
  repos: "repositories",
  dep: "dependency",
  deps: "dependencies",
  pkg: "package",
  pkgs: "packages",
  dir: "directory",
  dirs: "directories",
  msg: "message",
  msgs: "messages",
  err: "error",
  errs: "errors",
  req: "request",
  res: "response",
  ctx: "context",
  impl: "implementation",
  init: "initialization",
  perf: "performance",
  // Auth / security
  auth: "authentication",
  authz: "authorization",
  creds: "credentials",
  token: "token", // already fine, keep for completeness
  // Frontend
  comp: "component",
  comps: "components",
  // Networking
  URL: "URL", // already fine
  // Formatting shortcuts caveman uses
  w: "with",
  "w/": "with",
  wo: "without",
  "w/o": "without",
  // Data
  val: "value",
  vals: "values",
  obj: "object",
  objs: "objects",
  arr: "array",
  arrs: "arrays",
  str: "string",
  strs: "strings",
  num: "number",
  nums: "numbers",
  bool: "boolean",
  int: "integer",
};

// Build a regex that matches whole words only.
// We match case-insensitively but restore the expansion with proper casing.
const ABBREV_KEYS = Object.keys(ABBREVS).sort((a, b) => b.length - a.length); // longest first

// Escape special regex chars in keys (e.g. "w/")
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Case-insensitive match. Expansion values are already the desired form (lowercase
// prose, or preserved ALL-CAPS like "URL"). Capitalisation at sentence starts is
// handled downstream by the punctuation rule.
const ABBREV_RE = new RegExp(
  `(?<=^|\\s|[([{])(${ABBREV_KEYS.map(escapeRegex).join("|")})(?=$|\\s|[)\\]},.:;!?])`,
  "gi",
);

function expandAbbreviations(text: string): string {
  return text.replace(ABBREV_RE, (match: string) => {
    // Look up by original match, then lowercase fallback.
    return ABBREVS[match] ?? ABBREVS[match.toLowerCase()] ?? match;
  });
}

export const abbreviationsRule: Rule = {
  name: "abbreviations",
  apply: expandAbbreviations,
};
