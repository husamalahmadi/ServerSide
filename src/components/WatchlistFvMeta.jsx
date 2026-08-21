import React from "react";
import { fairValueMove } from "../../shared/fairValueVerdict.js";
import { fmt2 } from "../domain/formatting.js";

const badgeStyle = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const BADGE_TONE = {
  now_undervalued: { background: "#dcfce7", color: "#15803d" },
  now_overvalued: { background: "#fee2e2", color: "#b91c1c" },
  move: { background: "#fef3c7", color: "#92400e" },
};

function badgeLabel(reason, movePct, t) {
  if (reason === "now_undervalued") return t("WATCHLIST_FV_NOW_UNDERVALUED");
  if (reason === "now_overvalued") return t("WATCHLIST_FV_NOW_OVERVALUED");
  if (reason === "move" && movePct != null) {
    return t("WATCHLIST_FV_MOVED").replace("{pct}", String(movePct));
  }
  return null;
}

/**
 * Latest fair value for one watchlist row, plus a badge when the daily sweep flagged it.
 * Renders an em dash while no fair value has been computed yet.
 */
export function WatchlistFvMeta({ item, t }) {
  const fv = Number(item?.last_known_fv);
  const hasFv = Number.isFinite(fv) && fv > 0;
  const reason = item?.fv_change_reason || null;
  const move = fairValueMove(item?.fair_value_at_add, item?.last_known_fv);
  const movePct = move == null ? null : Math.round(Math.abs(move) * 100);
  const label = badgeLabel(reason, movePct, t);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13, color: "#475569" }}>
      <span>
        {t("WATCHLIST_FV_LABEL")}:{" "}
        <b>{hasFv ? `${fmt2(fv)}${item?.currency ? ` ${item.currency}` : ""}` : "—"}</b>
      </span>
      {label ? <span style={{ ...badgeStyle, ...(BADGE_TONE[reason] || BADGE_TONE.move) }}>{label}</span> : null}
    </span>
  );
}
