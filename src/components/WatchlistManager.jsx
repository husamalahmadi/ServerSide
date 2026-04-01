import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiUrl } from "../config/env.js";
import { Card } from "./Card.jsx";

function normalizeWatchlists(raw) {
  return (raw || []).map((list) => ({
    ...list,
    items: (list.items || []).map((x) => {
      if (typeof x === "string") return { ticker: x };
      return { ticker: x.ticker, created_at: x.created_at };
    }),
  }));
}

export function WatchlistManager({ ticker, t }) {
  const { user } = useAuth();
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const apiUrl = getApiUrl();
  const trans = (key) => (t ? t(key) : key);

  const loadWatchlists = useCallback(() => {
    if (!user) {
      setWatchlists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${apiUrl}/api/watchlists/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setWatchlists(normalizeWatchlists(data.watchlists)))
      .catch(() => setWatchlists([]))
      .finally(() => setLoading(false));
  }, [user, apiUrl]);

  useEffect(() => loadWatchlists(), [loadWatchlists]);

  const normSym = (s) => String(s ?? "").trim().toUpperCase();
  const tickerNorm = normSym(ticker);
  const inList = (list) => list.items?.some((i) => normSym(i.ticker) === tickerNorm);

  const addToList = async (listId) => {
    if (!user || !ticker) return;
    setSaveError("");
    try {
      const res = await fetch(`${apiUrl}/api/watchlists/${listId}/items`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: normSym(ticker), action: "add" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || trans("WATCHLIST_SAVE_FAILED"));
        return;
      }
      loadWatchlists();
    } catch (e) {
      console.error("Add to watchlist failed:", e);
      setSaveError(trans("WATCHLIST_SAVE_FAILED"));
    }
  };

  const removeFromList = async (listId) => {
    if (!user || !ticker) return;
    setSaveError("");
    try {
      const res = await fetch(`${apiUrl}/api/watchlists/${listId}/items`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: normSym(ticker), action: "remove" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || trans("WATCHLIST_SAVE_FAILED"));
        return;
      }
      loadWatchlists();
    } catch (e) {
      console.error("Remove from watchlist failed:", e);
      setSaveError(trans("WATCHLIST_SAVE_FAILED"));
    }
  };

  const createList = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiUrl}/api/watchlists`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), isPublic: true }),
      });
      if (res.ok) {
        setNewName("");
        loadWatchlists();
      }
    } catch (e) {
      console.error("Create watchlist failed:", e);
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <Card title={trans("WATCHLISTS") || "Watchlists"}>
        <div style={{ color: "#64748b", fontSize: 14 }}>
          {trans("SIGN_IN_TO_WATCHLIST") || "Sign in to manage watchlists"}
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card title={trans("WATCHLISTS") || "Watchlists"}>
        <div style={{ color: "#64748b" }}>{trans("LOADING") || "Loading…"}</div>
      </Card>
    );
  }

  return (
    <Card title={trans("WATCHLISTS") || "Watchlists"}>
      <div style={{ display: "grid", gap: 12 }}>
        {ticker ? (
          <div
            style={{
              padding: 12,
              background: "#f0fdf4",
              borderRadius: 8,
              border: "1px solid #bbf7d0",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              {trans("ADD_TO_WATCHLIST") || "Add"} {ticker} {trans("TO_WATCHLIST") || "to watchlist"}
            </div>
            {saveError ? (
              <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10, lineHeight: 1.4 }} role="alert">
                {saveError}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              {watchlists.map((list) => {
                const hasTicker = inList(list);
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => {
                      if (hasTicker) void removeFromList(list.id);
                      else void addToList(list.id);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #1a3a2a",
                      background: hasTicker ? "#fff" : "#1a3a2a",
                      color: hasTicker ? "#1a3a2a" : "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {hasTicker ? `${list.name} ✓` : `+ ${list.name}`}
                  </button>
                );
              })}
              {watchlists.length === 0 ? (
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  {trans("CREATE_WATCHLIST_FIRST") || "Create a watchlist below first"}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={trans("NEW_WATCHLIST") || "New watchlist name"}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              minWidth: 160,
            }}
          />
          <button
            type="button"
            onClick={createList}
            disabled={!newName.trim() || creating}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#1a3a2a",
              color: "#fff",
              fontWeight: 600,
              cursor: newName.trim() && !creating ? "pointer" : "not-allowed",
              opacity: newName.trim() && !creating ? 1 : 0.6,
            }}
          >
            {creating ? "…" : trans("CREATE") || "Create"}
          </button>
        </div>
        {watchlists.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 14 }}>
            {trans("NO_WATCHLISTS") || "No watchlists yet. Create one above."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {watchlists.map((list) => (
              <div
                key={list.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{list.name}</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  {(list.items || []).length} {trans("ITEMS") || "stocks"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
