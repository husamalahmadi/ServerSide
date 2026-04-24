import { useMemo, useState } from "react";
import { applyScreenerFilters, sortScreenerItems } from "../domain/screener.js";

const DEFAULT_FILTERS = {
  market: "all",
  sector: "all",
  query: "",
  peMin: 0,
  peMax: 60,
  marketCapMin: 0,
  marketCapMax: 5000000000000,
  discountMin: -80,
  discountMax: 200,
};

export function useScreener(items, initialFilters = null) {
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    ...(initialFilters || {}),
  });
  const [sortBy, setSortBy] = useState("discountPct");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => applyScreenerFilters(items, filters), [items, filters]);
  const sorted = useMemo(() => sortScreenerItems(filtered, sortBy, sortDir), [filtered, sortBy, sortDir]);

  function onSort(nextSortBy) {
    if (nextSortBy === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir(nextSortBy === "ticker" ? "asc" : "desc");
  }

  function applyPreset(presetId) {
    if (presetId === "undervalued") {
      setFilters((f) => ({ ...f, discountMin: 15, discountMax: 300, peMin: 0, peMax: 30 }));
      setSortBy("discountPct");
      setSortDir("desc");
      return;
    }
    if (presetId === "largecap") {
      setFilters((f) => ({
        ...f,
        marketCapMin: 10000000000,
        marketCapMax: 5000000000000,
      }));
      setSortBy("marketCap");
      setSortDir("desc");
      return;
    }
    if (presetId === "tasi") {
      setFilters((f) => ({ ...f, market: "sa", discountMin: -80, discountMax: 300 }));
      setSortBy("discountPct");
      setSortDir("desc");
      return;
    }
    if (presetId === "reset") {
      setFilters({ ...DEFAULT_FILTERS });
      setSortBy("discountPct");
      setSortDir("desc");
    }
  }

  return {
    filters,
    setFilters,
    sortBy,
    sortDir,
    onSort,
    applyPreset,
    filteredCount: filtered.length,
    items: sorted,
  };
}
