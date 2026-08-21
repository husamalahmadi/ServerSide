/**
 * Over/undervalued verdict and fair-value change detection.
 * Shared so the stock page verdict and the watchlist sweep judge a price against a
 * fair value the same way. The fair value itself comes from shared/evFairValue.js.
 */

/** @param {unknown} v */
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A fair-value move this large (as a fraction) is worth telling the user about. */
export const FV_MATERIAL_MOVE = 0.1;

/** Fair value above price = undervalued. */
export function isUndervalued(price, fairValue) {
  const p = num(price);
  const fv = num(fairValue);
  return p != null && p > 0 && fv != null && fv > p;
}

/** @returns {"undervalued"|"overvalued"|null} null when either side is unusable. */
export function fairValueVerdict(price, fairValue) {
  const p = num(price);
  const fv = num(fairValue);
  if (p == null || p <= 0 || fv == null || fv <= 0) return null;
  return fv > p ? "undervalued" : "overvalued";
}

/** Signed change between two fair values, as a fraction of the baseline. */
export function fairValueMove(baseline, current) {
  const from = num(baseline);
  const to = num(current);
  if (from == null || from <= 0 || to == null) return null;
  return (to - from) / from;
}

/**
 * Whether a watchlist row moved enough to be worth surfacing.
 *
 * Both verdicts use today's price, so a flip means the fair value crossed the price
 * rather than the market having moved. `shouldNotify` is false while the fair value
 * sits within FV_MATERIAL_MOVE of the value we last reported, which stops one move
 * from being announced every day.
 *
 * @param {{ fairValueAtAdd?: number|null, lastKnownFv?: number|null, lastNotifiedFv?: number|null, price?: number|null }} args
 */
export function detectFairValueChange({
  fairValueAtAdd,
  lastKnownFv,
  lastNotifiedFv,
  price,
} = {}) {
  const move = fairValueMove(fairValueAtAdd, lastKnownFv);
  const movedEnough = move != null && Math.abs(move) >= FV_MATERIAL_MOVE;

  const verdictAtAdd = fairValueVerdict(price, fairValueAtAdd);
  const verdictNow = fairValueVerdict(price, lastKnownFv);
  const flipped = verdictAtAdd != null && verdictNow != null && verdictAtAdd !== verdictNow;

  const reason = flipped
    ? verdictNow === "undervalued"
      ? "now_undervalued"
      : "now_overvalued"
    : movedEnough
      ? "move"
      : null;

  const sinceNotified = fairValueMove(lastNotifiedFv, lastKnownFv);
  const alreadyReported =
    num(lastNotifiedFv) != null &&
    (sinceNotified == null || Math.abs(sinceNotified) < FV_MATERIAL_MOVE);

  return {
    changed: reason != null,
    reason,
    move,
    verdictAtAdd,
    verdictNow,
    shouldNotify: reason != null && !alreadyReported,
  };
}
