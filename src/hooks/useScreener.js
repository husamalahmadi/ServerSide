import { useMemo, useState } from "react";
import { sortScreenerItems } from "../domain/screener.js";

export function useScreener(items) {
  const [activePreset, setActivePreset] = useState("reset");
  const [sortBy, setSortBy] = useState("discountPct");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    if (activePreset === "reset") return [];
    if (activePreset === "tasi") return rows.filter((it) => it.market === "sa" && Number(it.discountPct) > 0);
    if (activePreset === "us") return rows.filter((it) => it.market === "us" && Number(it.discountPct) > 0);
    return rows.filter((it) => Number.isFinite(Number(it.discountPct)));
  }, [items, activePreset]);
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
    setActivePreset(presetId);
    setSortBy("discountPct");
    setSortDir("desc");
  }

  return {
    activePreset,
    sortBy,
    sortDir,
    onSort,
    applyPreset,
    filteredCount: filtered.length,
    items: sorted,
  };
}
