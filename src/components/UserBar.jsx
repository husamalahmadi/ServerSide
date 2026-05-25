import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { GoogleGIcon } from "./GoogleGIcon.jsx";
import { AvatarImg } from "./AvatarImg.jsx";

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
        className="tp-user-menu-btn"
        onClick={() => setOpen((o) => !o)}
      >
        <AvatarImg src={user.picture} size={28} />
        <span style={{ fontWeight: 600, color: "#374151" }}>
          {user.handle ? `@${user.handle}` : user.name || "User"}
        </span>
      </button>
      {open ? (
        <div className="tp-user-menu">
          <Link
            to={user.handle && user.profile_completed ? `/profile/${user.handle}` : "/profile/setup"}
            className="tp-user-menu-item tp-user-menu-item--border"
          >
            My profile
          </Link>
          <div className="tp-user-menu-meta">{user.email}</div>
          <button type="button" className="tp-user-menu-item" onClick={logout}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
