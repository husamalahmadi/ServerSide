const KEY = "tp_anon_watchlist";

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("tp-anon-watchlist"));
}

export function readAnonWatchlist() {
  return read();
}

export function anonWatchlistHas(ticker) {
  return read().includes(String(ticker || "").trim().toUpperCase());
}

export function addAnonWatchlist(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) return read();
  const next = read();
  if (!next.includes(symbol)) next.push(symbol);
  write(next);
  return next;
}

export function removeAnonWatchlist(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  const next = read().filter((item) => item !== symbol);
  write(next);
  return next;
}

export function clearAnonWatchlist() {
  write([]);
}
