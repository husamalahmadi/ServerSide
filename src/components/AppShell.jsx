import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { UserBar } from "./UserBar.jsx";
import { LangToggle } from "./LangToggle.jsx";
function NavIcon({ name }) {
  const paths = {
    home: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.9" />
      </>
    ),
    chart: <path d="M4 18V8M10 18V4M16 18v-6M22 18V10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />,
    blog: <path d="M6 5h12v14H8l-2 2V5z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M12 10v6M12 8v0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    mail: <path d="M4 7l8 6 8-6v10H4V7z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      {paths[name] || paths.home}
    </svg>
  );
}

export function AppShell() {
  const { t, lang, dir, toggleLang } = useI18n();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topSearch, setTopSearch] = useState("");

  const onTopSearch = (e) => {
    e.preventDefault();
    const q = topSearch.trim();
    if (!q) {
      navigate("/");
      return;
    }
    navigate(`/?q=${encodeURIComponent(q)}`);
    setTopSearch("");
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="tp-app" dir={dir} lang={lang}>
      <div
        className={`tp-sidebar-backdrop${sidebarOpen ? " open" : ""}`}
        onClick={closeSidebar}
        aria-hidden
      />
      <aside className={`tp-sidebar${sidebarOpen ? " open" : ""}`}>
        <Link to="/" className="tp-sidebar-brand" onClick={closeSidebar}>
          <span className="tp-sidebar-logo">TP</span>
          <span>
            <div className="tp-sidebar-title">TruePrice.Cash</div>
            <div className="tp-sidebar-tag">US · TASI · Tokyo</div>
          </span>
        </Link>

        <nav className="tp-nav-section" aria-label="Main">
          <div className="tp-nav-label">{t("FOOTER_NAV_SITE")}</div>
          <NavLink to="/" end className="tp-nav-link" onClick={closeSidebar}>
            <NavIcon name="home" />
            {lang === "ar" ? "الرئيسية" : "Dashboard"}
          </NavLink>
          <a href="/#screener" className="tp-nav-link" onClick={closeSidebar}>
            <NavIcon name="chart" />
            {lang === "ar" ? "فلتر الأسهم" : "Stock Screener"}
          </a>
          <NavLink to="/blogs" className="tp-nav-link" onClick={closeSidebar}>
            <NavIcon name="blog" />
            {t("BLOGS")}
          </NavLink>
          <NavLink to="/about" className="tp-nav-link" onClick={closeSidebar}>
            <NavIcon name="info" />
            {t("ABOUT_US")}
          </NavLink>
          <NavLink to="/contact" className="tp-nav-link" onClick={closeSidebar}>
            <NavIcon name="mail" />
            {t("CONTACT_US")}
          </NavLink>
        </nav>

        <div className="tp-sidebar-foot">© TruePrice.Cash</div>
      </aside>

      <div className="tp-main">
        <header className="tp-topbar">
          <button
            type="button"
            className="tp-menu-btn"
            aria-label="Menu"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            ☰
          </button>
          <form className="tp-topbar-search" onSubmit={onTopSearch}>
            <span className="tp-topbar-search-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={topSearch}
              onChange={(e) => setTopSearch(e.target.value)}
              placeholder={t("SEARCH_PLACEHOLDER")}
              aria-label={t("SEARCH")}
            />
          </form>
          <div className="tp-topbar-actions">
            <UserBar />
            <LangToggle lang={lang} onToggle={toggleLang} t={t} />
          </div>
        </header>
        <main className="tp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
