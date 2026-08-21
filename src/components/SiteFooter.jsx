import React from "react";
import { Link } from "react-router-dom";

/** Deep internal stock links — varied anchor text (ticker + company), not domain-only. */
export const FOOTER_STOCK_LINKS = [
  { ticker: "AAPL", labelKey: "FOOTER_STOCK_AAPL" },
  { ticker: "MSFT", labelKey: "FOOTER_STOCK_MSFT" },
  { ticker: "2222", labelKey: "FOOTER_STOCK_ARAMCO" },
  { ticker: "2010", labelKey: "FOOTER_STOCK_SABIC" },
  { ticker: "2020", labelKey: "FOOTER_STOCK_SABIC_AGRI" },
  { ticker: "1120", labelKey: "FOOTER_STOCK_RAJHI" },
  { ticker: "7203.T", labelKey: "FOOTER_STOCK_TOYOTA" },
  { ticker: "6758.T", labelKey: "FOOTER_STOCK_SONY" },
];

const SITE_LINKS = [
  { to: "/", labelKey: "FOOTER_HOME" },
  { to: "/blogs", labelKey: "BLOGS" },
  { to: "/methodology", labelKey: "METHODOLOGY_NAV" },
  { to: "/about", labelKey: "ABOUT_US" },
  { to: "/contact", labelKey: "CONTACT_US" },
];

const EXTERNAL_MARKET_LINKS = [
  { href: "https://www.nyse.com", labelKey: "FOOTER_EXCHANGE_NYSE" },
  { href: "https://www.saudiexchange.sa", labelKey: "FOOTER_EXCHANGE_TADAWUL" },
  { href: "https://www.jpx.co.jp", labelKey: "FOOTER_EXCHANGE_TSE" },
];

const footerHeadingStyle = {
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--tp-ink-strong)",
  marginBottom: 10,
};

const footerDisclaimerStyle = {
  margin: "0 0 12px",
  textAlign: "start",
  fontSize: 11,
  lineHeight: 1.7,
  color: "var(--tp-muted)",
};

/**
 * Sitewide footer: internal navigation, deep stock links, XML sitemap, external market
 * references, and the CMA disclaimer shown on every route.
 */
export function SiteFooter({ t }) {
  return (
    <footer className="tp-site-footer no-print">
      <div
        className="tp-footer-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 20,
          marginBottom: 20,
          textAlign: "start",
        }}
      >
        <nav aria-label={t("FOOTER_NAV_SITE")}>
          <div style={footerHeadingStyle}>{t("FOOTER_NAV_SITE")}</div>
          <ul className="tp-footer-nav-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {SITE_LINKS.map(({ to, labelKey }) => (
              <li key={to}>
                <Link to={to} className="tp-footer-link" style={{ fontWeight: 600 }}>
                  {t(labelKey)}
                </Link>
              </li>
            ))}
            <li>
              <a href="/sitemap.xml" className="tp-footer-link" style={{ fontWeight: 600 }}>
                {t("FOOTER_SITEMAP")}
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("FOOTER_NAV_STOCKS")}>
          <div style={footerHeadingStyle}>{t("FOOTER_NAV_STOCKS")}</div>
          <ul className="tp-footer-nav-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {FOOTER_STOCK_LINKS.map(({ ticker, labelKey }) => (
              <li key={ticker}>
                <Link to={`/stock/${encodeURIComponent(ticker)}`} className="tp-footer-link" style={{ fontWeight: 600 }}>
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("FOOTER_NAV_EXTERNAL")}>
          <div style={footerHeadingStyle}>{t("FOOTER_NAV_EXTERNAL")}</div>
          <ul className="tp-footer-nav-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {EXTERNAL_MARKET_LINKS.map(({ href, labelKey }) => (
              <li key={href}>
                <a href={href} className="tp-footer-link" style={{ fontWeight: 500 }} target="_blank" rel="noopener noreferrer">
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p style={footerDisclaimerStyle}>{t("CMA_DISCLAIMER")}</p>
      <p style={{ margin: 0, textAlign: "center", fontSize: 11 }}>© TruePrice.Cash</p>
    </footer>
  );
}
