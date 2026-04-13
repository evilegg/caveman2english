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
// Escape special regex chars in keys (e.g. "w/")
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(dict: Record<string, string>): RegExp {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length); // longest first
  if (keys.length === 0) return /(?!)/; // never-matching sentinel
  return new RegExp(
    `(?<=^|\\s|[([{])(${keys.map(escapeRegex).join("|")})(?=$|\\s|[)\\]},.:;!?])`,
    "gi",
  );
}

function expandWith(dict: Record<string, string>): (text: string) => string {
  const re = buildRegex(dict);
  return (text) =>
    text.replace(re, (match: string) => dict[match] ?? dict[match.toLowerCase()] ?? match);
}

// Default rule using only the built-in dictionary.
export const abbreviationsRule: Rule = {
  name: "abbreviations",
  apply: expandWith(ABBREVS),
};

// Factory: merge extra abbreviations on top of the built-in dictionary.
export function createAbbreviationsRule(extra: Record<string, string> = {}): Rule {
  if (Object.keys(extra).length === 0) return abbreviationsRule;
  const merged = { ...ABBREVS, ...extra };
  return { name: "abbreviations", apply: expandWith(merged) };
}
