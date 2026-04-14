/**
 * Shared scoring utilities — re-exported here so UST and RFC benchmarks
 * don't need to reach into the fidelity experiment.
 */

export { rouge1, compressionRatio, modalRecovery } from "../fidelity/scorer.js";
export { extractModals, tokenize } from "../fidelity/encoder.js";
