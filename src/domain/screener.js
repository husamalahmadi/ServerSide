function inRange(v, min, max) {
  if (v == null) return false;
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
}

export function applyScreenerFilters(items, filters) {
  const q = (filters.query || "").trim().toLowerCase();
  return (items || []).filter((it) => {
    if (filters.market !== "all" && it.market !== filters.market) return false;
    if (filters.sector !== "all" && it.sector !== filters.sector) return false;
    if (q) {
      const t = String(it.ticker || "").toLowerCase();
      const n = String(it.name || "").toLowerCase();
      if (!t.includes(q) && !n.includes(q)) return false;
    }
    if (!inRange(it.pe, filters.peMin, filters.peMax)) return false;
    if (!inRange(it.marketCap, filters.marketCapMin, filters.marketCapMax)) return false;
    if (!inRange(it.discountPct, filters.discountMin, filters.discountMax)) return false;
    return true;
  });
}

export function sortScreenerItems(items, sortBy, sortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  const sorted = [...(items || [])];
  sorted.sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];
    if (typeof av === "string" || typeof bv === "string") {
      return String(av || "").localeCompare(String(bv || "")) * dir;
    }
    const an = Number.isFinite(Number(av)) ? Number(av) : Number.NEGATIVE_INFINITY;
    const bn = Number.isFinite(Number(bv)) ? Number(bv) : Number.NEGATIVE_INFINITY;
    return (an - bn) * dir;
  });
  return sorted;
}
