import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { GoogleGIcon } from "./GoogleGIcon.jsx";
import { AvatarImg } from "./AvatarImg.jsx";

const menuStyle = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  minWidth: 160,
  zIndex: 100,
  padding: "8px 0",
};

export function UserBar() {
  const { user, loading, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const signInNavigating = useRef(false);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  if (loading) {
    return <span style={{ color: "#64748b", fontSize: 14 }}>…</span>;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => {
          if (signInNavigating.current) return;
          signInNavigating.current = true;
          login();
        }}
        className="tp-signin-google"
      >
        <GoogleGIcon size={13} />
        Sign in with Google
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fff",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        <AvatarImg src={user.picture} size={28} />
        <span style={{ fontWeight: 600, color: "#374151" }}>
          {user.handle ? `@${user.handle}` : user.name || "User"}
        </span>
      </button>
      {open ? (
        <div style={menuStyle}>
          <Link
            to={user.handle && user.profile_completed ? `/profile/${user.handle}` : "/profile/setup"}
            style={{
              display: "block",
              padding: "10px 12px",
              textAlign: "left",
              color: "#374151",
              textDecoration: "none",
              borderBottom: "1px solid #f1f5f9",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            My profile
          </Link>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#64748b" }}>
            {user.email}
          </div>
          <button
            type="button"
            onClick={logout}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 12px",
              textAlign: "left",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#374151",
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
