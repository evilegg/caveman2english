/**
 * Esperanto ↔ English vocabulary for technical prose.
 *
 * Design principles:
 *  - Prefer borrowed Esperanto words that stay close to English roots
 *    (easier for both LLM encoding and rule-based decoding).
 *  - Use native Esperanto compounds where they are clearly shorter or
 *    semantically more precise than the English term.
 *  - Keep standard abbreviations (DB, auth, cfg, fn…) when the Esperanto
 *    word is longer — abbreviations survive both directions unchanged.
 *
 * Why Esperanto for technical prose:
 *  - No indefinite article (saves "a"/"an" tokens).
 *  - Modal verbs have distinct conjugation suffixes:
 *      -as  present indicative   (rompas  = breaks)
 *      -is  past indicative      (rompiĝis = broke)
 *      -os  future indicative    (rompos  = will break)
 *      -us  conditional          (devus   = should / ought to)
 *  - "devus" encodes ONLY "should" (conditional of devi = must); it cannot
 *    be accidentally stripped without information loss, unlike English prose.
 *  - Causal conjunction "ĉar" is shorter than "because" and unambiguous
 *    (English "since" is polysemous: temporal vs causal).
 *  - Negation "ne" is a single pre-verbal token; "sen" means "without".
 *  - Quantifier "ĉiu" = each/every (single token).
 */

// ── English → Esperanto vocabulary ──────────────────────────────────────────

export const TO_EO: Record<string, string> = {
  // Infrastructure
  server: "servilo",
  client: "kliento",
  database: "datumbazo",
  connection: "konekto",
  pool: "rezervo",
  queue: "vico",
  thread: "fadeno",
  cache: "kaŝmemoro",
  memory: "memoro",
  "memory leak": "memorliko",

  // Web / Auth
  request: "peto",
  response: "respondo",
  token: "ĵetono",
  session: "sesio",
  cookie: "kuketo",
  header: "kapo",
  origin: "origino",
  middleware: "mezvaro",

  // Code structure
  function: "funkcio",
  component: "komponento",
  object: "objekto",
  reference: "referenco",
  variable: "variablo",
  state: "stato",
  promise: "promeso",
  event: "evento",
  listener: "aŭskultilo",
  hook: "hoko",
  block: "bloko",
  call: "voko",
  type: "tipo",
  interface: "interfaco",
  module: "modulo",
  property: "eco",
  value: "valoro",
  string: "ĉeno",
  number: "nombro",
  file: "dosiero",
  directory: "dosierujo",
  package: "pako",
  dependency: "dependaĵo",
  version: "versio",
  key: "ŝlosilo",

  // Actions / states
  error: "eraro",
  bug: "cimo",
  leak: "liko",
  render: "bildigo",
  mount: "almeto",
  unmount: "forigalmeto",
  release: "liberigo",
  cleanup: "purigado",
  timeout: "templimo",
  conflict: "konflikto",

  // Environments
  environment: "medio",
  configuration: "agordo",
  container: "ujo",
  cluster: "aro",
};

// ── Esperanto → English (reverse lookup) ────────────────────────────────────

export const FROM_EO: Record<string, string> = Object.fromEntries(
  Object.entries(TO_EO).map(([en, eo]) => [eo, en]),
);

// ── Modal verb transformations ───────────────────────────────────────────────
//
// English modal phrases → Esperanto equivalents.
// "devus" (conditional of devi) encodes exactly "should/ought to".
// "eble" (adverb of ebla = possible) encodes "might/may/possibly".
// "povus" (conditional of povi = can) encodes "could".
// "devas" (present of devi) encodes "must/need to/have to".

export const MODAL_TO_EO: [RegExp, string][] = [
  [/\bshould\b/gi, "devus"],
  [/\bmust\b/gi, "devas"],
  [/\bneed to\b/gi, "devas"],
  [/\bhave to\b/gi, "devas"],
  [/\bmight\b/gi, "eble"],
  [/\bmay\b/gi, "eble"],
  [/\bcould\b/gi, "povus"],
  [/\bwould\b/gi, "povus"],
];

export const MODAL_FROM_EO: [RegExp, string][] = [
  [/\bdevus\b/g, "should"],
  [/\bdevas\b/g, "must"],
  [/\beble\b/g, "might"],
  [/\bpovus\b/g, "could"],
];

// ── Conjunction transformations ──────────────────────────────────────────────
//
// Esperanto causal/contrastive conjunctions are shorter and less ambiguous
// than their English counterparts.  "ĉar" = because (not "since" which is
// temporal in English); "tamen" = however/nevertheless; "sed" = but.

export const CONJ_TO_EO: [RegExp, string][] = [
  [/\bbecause\b/gi, "ĉar"],
  [/\bsince\b/gi, "ĉar"],
  [/\btherefore\b/gi, "tial"],
  [/\bthus\b/gi, "tial"],
  [/\bhence\b/gi, "tial"],
  [/\bhowever\b/gi, "tamen"],
  [/\bnevertheless\b/gi, "tamen"],
  [/\bbut\b/gi, "sed"],
  [/\balthough\b/gi, "kvankam"],
  [/\bwhile\b/gi, "dum"],
  [/\bwhereas\b/gi, "dum"],
];

// NOTE: ĉ (U+0109) is not in \w, so \b fails before it.  Use Unicode-aware
// lookarounds with the `u` flag for any pattern starting with a diacritic.
export const CONJ_FROM_EO: [RegExp, string][] = [
  [/(?<!\p{L})ĉar(?!\p{L})/gu, "because"],
  [/\btial\b/g, "therefore"],
  [/\btamen\b/g, "however"],
  [/\bsed\b/g, "but"],
  [/\bkvankam\b/g, "although"],
  [/\bdum\b/g, "while"],
];

// ── Quantifier / negation transformations ────────────────────────────────────
//
// "ĉiu" = each/every (single token, unambiguous count).
// "ne" = not/never (pre-verbal negation in Esperanto).
// "sen" = without (preposition, not verbal negation).

export const QUANT_TO_EO: [RegExp, string][] = [
  [/\beach\b/gi, "ĉiu"],
  [/\bevery\b/gi, "ĉiu"],
];

export const QUANT_FROM_EO: [RegExp, string][] = [
  [/(?<!\p{L})ĉiu(?!\p{L})/gu, "each"],
];

export const NEG_TO_EO: [RegExp, string][] = [
  [/\bwithout\b/gi, "sen"],
  [/\bnever\b/gi, "neniam"],
];

export const NEG_FROM_EO: [RegExp, string][] = [
  [/\bsen\b/g, "without"],
  [/\bneniam\b/g, "never"],
];
