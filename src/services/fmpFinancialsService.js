import { fmpFinancials } from "./fmpService.js";
import { fmpStatementsToMergeInputs, fmpStatementsToValuation } from "../domain/fmpFinancialsMap.js";

const _inflight = new Map();

/**
 * Load company financial statements from FMP (proxied by Express).
 * @param {string} fmpSymbol  e.g. "AAPL" or "2222.SR"
 */
export async function getFmpCompanyFinancials(fmpSymbol) {
  const key = String(fmpSymbol || "").trim();
  if (!key) throw new Error("FMP symbol required");
  if (_inflight.has(key)) return _inflight.get(key);
  const p = fmpFinancials(key).finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

export function fmpToFinancialsFormat(bundle) {
  return fmpStatementsToMergeInputs(bundle);
}

export function fmpToValuationFormat(bundle) {
  return fmpStatementsToValuation(bundle);
}
