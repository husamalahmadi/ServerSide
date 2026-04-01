import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../i18n.jsx";
import { getApiUrl } from "../config/env.js";
import { Card } from "../components/Card.jsx";
import { AvatarImg } from "../components/AvatarImg.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { LangToggle } from "../components/LangToggle.jsx";

export default function Profile() {
  const { handle: urlHandle } = useParams();
  const location = useLocation();
  const { lang, dir, t, toggleLang } = useI18n();
  const { user: currentUser, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ handle: "", name: "", bio: "", dateOfBirth: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const apiUrl = getApiUrl();

  const isOwnProfile = currentUser && (urlHandle === currentUser.handle || (!urlHandle && currentUser));

  useEffect(() => {
    if (!apiUrl) return;
    const handleToFetch = urlHandle || (currentUser?.handle);
    if (!handleToFetch) {
      if (currentUser && !authLoading) {
        navigate(`/profile/${currentUser.handle}`, { replace: true });
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${apiUrl}/api/users/${handleToFetch}`, { credentials: "include", cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setProfile(data);
        setEditForm({
          handle: data.user?.handle || "",
          name: data.user?.name || "",
          bio: data.user?.bio || "",
          dateOfBirth: data.user?.date_of_birth || "",
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [apiUrl, urlHandle, currentUser?.handle, currentUser?.id, authLoading, navigate, location.key]);

  /** Refetch when returning to this tab (e.g. after posting a comment on a stock page in another tab). */
  useEffect(() => {
    const handleToFetch = urlHandle || currentUser?.handle;
    if (!apiUrl || !handleToFetch || !currentUser || authLoading) return;
    const isOwner = urlHandle === currentUser.handle || (!urlHandle && currentUser.handle);
    if (!isOwner) return;
    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`${apiUrl}/api/users/${handleToFetch}`, { credentials: "include", cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then((data) => {
          setProfile(data);
          setEditForm({
            handle: data.user?.handle || "",
            name: data.user?.name || "",
            bio: data.user?.bio || "",
            dateOfBirth: data.user?.date_of_birth || "",
          });
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", refetch);
    return () => document.removeEventListener("visibilitychange", refetch);
  }, [apiUrl, urlHandle, currentUser?.handle, currentUser?.id, authLoading]);

  useEffect(() => {
    if (isOwnProfile && !urlHandle && currentUser?.handle) {
      navigate(`/profile/${currentUser.handle}`, { replace: true });
    }
  }, [isOwnProfile, urlHandle, currentUser?.handle, navigate]);

  /** Must run every render (before any early return) — Rules of Hooks. */
  const profileStockComments = useMemo(() => {
    if (!profile?.user) return [];
    const rows = (profile.comments || []).map((c) => ({
      key: `c-${c.id}`,
      ticker: c.ticker,
      body: c.body,
      created_at: c.created_at,
    }));
    rows.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    return rows;
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/users/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: editForm.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
          name: editForm.name.trim(),
          bio: editForm.bio.trim(),
          dateOfBirth: editForm.dateOfBirth.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("PROFILE_SAVE_FAILED"));
        return;
      }
      await refreshUser();
      setProfile((p) => (p ? { ...p, user: data.user } : { user: data.user, watchlists: [], comments: [] }));
      setEditMode(false);
    } catch {
      setError(t("PROFILE_SAVE_FAILED"));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    fontSize: 14,
  };

  if (authLoading || loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#64748b" }} dir={dir} lang={lang}>
        {t("PROFILE_LOADING")}
      </div>
    );
  }

  if (!profile?.user) {
    return (
      <div style={{ padding: 24 }} dir={dir} lang={lang}>
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <PillLink to="/">TruePrice.Cash</PillLink>
          <LangToggle lang={lang} onToggle={toggleLang} t={t} />
        </div>
        <div style={{ marginTop: 24, color: "#64748b" }}>{t("PROFILE_USER_NOT_FOUND")}</div>
      </div>
    );
  }

  const u = profile.user;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }} dir={dir} lang={lang}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <PillLink to="/">TruePrice.Cash</PillLink>
        <LangToggle lang={lang} onToggle={toggleLang} t={t} />
      </div>

      <Card>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            {u.picture ? (
              <AvatarImg src={u.picture} size={96} />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  color: "#64748b",
                }}
              >
                {u.name?.[0] || u.handle?.[0] || "?"}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.handle}
                  onChange={(e) => setEditForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                  style={inputStyle}
                  placeholder={t("PROFILE_USERNAME")}
                />
              ) : (
                <>@{u.handle}</>
              )}
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>{editMode ? t("PROFILE_DISPLAY_NAME") : (u.name || "—")}</div>
            {editMode && (
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                style={{ ...inputStyle, marginTop: 4 }}
                placeholder={t("PROFILE_DISPLAY_NAME")}
              />
            )}
            {(u.bio || (editMode && editForm.bio !== undefined)) && (
              <div style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
                {editMode ? (
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder={t("PROFILE_ABOUT_ME")}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                ) : (
                  u.bio
                )}
              </div>
            )}
            {u.date_of_birth && !editMode && (
              <div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>{t("PROFILE_BIRTH_DATE")}: {u.date_of_birth}</div>
            )}
            {editMode && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>{t("PROFILE_DATE_OF_BIRTH")}</label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            )}
            {isOwnProfile && (
              <div style={{ marginTop: 12 }}>
                {editMode ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "#1a3a2a",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      {saving ? t("PROFILE_SAVING") : t("PROFILE_SAVE")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {t("PROFILE_CANCEL")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #1a3a2a",
                      background: "#fff",
                      color: "#1a3a2a",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("PROFILE_EDIT")}
                  </button>
                )}
              </div>
            )}
            {error && <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{error}</div>}
          </div>
        </div>
      </Card>

      {/* Watchlists */}
      <Card title={t("WATCHLISTS")}>
        {profile.watchlists?.length === 0 ? (
          <div style={{ color: "#64748b" }}>{t("PROFILE_NO_PUBLIC_WATCHLISTS")}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {profile.watchlists?.map((list) => (
              <div
                key={list.id}
                style={{
                  padding: 12,
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{list.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(list.items || []).map((item) => {
                    const sym = typeof item === "string" ? item : item.ticker;
                    return (
                      <div key={sym}>
                        <Link
                          to={`/stock/${sym}`}
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            background: "#1a3a2a",
                            color: "#fff",
                            borderRadius: 6,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          {sym}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t("PROFILE_COMMENTS_AND_NOTES")}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          {t("PROFILE_COMMENTS_AND_NOTES_HINT")}
        </div>
        {profileStockComments.length === 0 ? (
          <div style={{ color: "#64748b" }}>{t("PROFILE_NO_COMMENTS_YET")}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {profileStockComments.map((row) => (
              <div
                key={row.key}
                style={{
                  padding: 12,
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#1d4ed8",
                      background: "#dbeafe",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {t("PROFILE_BADGE_STOCK_COMMENT")}
                  </span>
                  <Link to={`/stock/${row.ticker}`} style={{ color: "#2563eb", fontWeight: 600 }}>
                    {row.ticker}
                  </Link>
                  {row.created_at ? (
                    <span>· {new Date(row.created_at).toLocaleDateString()}</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{row.body}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
