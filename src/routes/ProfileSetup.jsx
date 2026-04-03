import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiUrl } from "../config/env.js";
import { Card } from "../components/Card.jsx";
import { PillLink } from "../components/PillLink.jsx";

export default function ProfileSetup() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [handle, setHandle] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: "0 auto", color: "#374151", lineHeight: 1.6 }}>
        <p style={{ marginBottom: 12 }}>
          We couldn&apos;t load your session yet. If you use <strong>one Render service</strong> for both the site and
          API, wait a few seconds (free tier cold start) and try the button below, or open your app again from the Render
          dashboard. If the <strong>frontend and API are on different URLs</strong>, set{" "}
          <code style={{ fontSize: 12 }}>VITE_API_URL</code> to your API&apos;s <code style={{ fontSize: 12 }}>https://…</code>{" "}
          in the <strong>frontend</strong> build environment and redeploy.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = `${getApiUrl()}/auth/google`;
          }}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            cursor: "pointer",
            borderRadius: 8,
            border: "1px solid #1a3a2a",
            background: "#1a3a2a",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Sign in with Google again
        </button>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          <PillLink to="/">← Home</PillLink>
        </p>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    const h = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!h || h.length < 3) {
      setError("Username must be at least 3 characters (letters, numbers, underscores)");
      return;
    }
    if (h.length > 30) {
      setError("Username must be 30 characters or less");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/users/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: h,
          name: name.trim() || user.name,
          bio: bio.trim(),
          dateOfBirth: dateOfBirth.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      await refreshUser();
      navigate(`/profile/${h}`, { replace: true });
    } catch (err) {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <PillLink to="/">TruePrice.Cash</PillLink>
      </div>
      <Card title="Complete your profile">
        <p style={{ color: "#64748b", marginBottom: 16, fontSize: 14 }}>
          Choose your username and add a few details. You can update these anytime.
        </p>
        <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              Username <span style={{ color: "#b91c1c" }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#64748b" }}>@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="e.g. johndoe"
                style={inputStyle}
                maxLength={30}
              />
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              3–30 characters, letters, numbers, underscores
            </div>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              Date of birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              About me
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short message about you..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          {error ? (
            <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>
          ) : null}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#1a3a2a",
                color: "#fff",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save & continue"}
            </button>
            <button
              type="button"
              onClick={async () => {
                setSaving(true);
                try {
                  await fetch(`${getApiUrl()}/api/users/me`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: user.name }),
                  });
                  await refreshUser();
                  navigate("/", { replace: true });
                } catch {
                  navigate("/", { replace: true });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Skip for now
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
