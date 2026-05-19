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
  { to: "/about", labelKey: "ABOUT_US" },
  { to: "/contact", labelKey: "CONTACT_US" },
];

/** Official exchange sites for US, TASI, and Tokyo (external references). */
const EXTERNAL_MARKET_LINKS = [
  { href: "https://www.nyse.com", labelKey: "FOOTER_EXCHANGE_NYSE" },
  { href: "https://www.saudiexchange.sa", labelKey: "FOOTER_EXCHANGE_TADAWUL" },
  { href: "https://www.jpx.co.jp", labelKey: "FOOTER_EXCHANGE_TSE" },
];

const footerStyle = {
  marginTop: 32,
  padding: "28px 4px 20px",
  borderTop: "1px solid var(--tp-border, #ddd8cc)",
  color: "var(--tp-muted, #8a8578)",
  fontSize: 12,
  lineHeight: 1.6,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 20,
  marginBottom: 20,
  textAlign: "start",
};

const headingStyle = {
  fontSize: 10,
  letterSpacing: "2px",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--tp-ink, #1a1a14)",
  marginBottom: 10,
};

const linkListStyle = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const anchorStyle = {
  color: "var(--tp-accent, #1a3a2a)",
  textDecoration: "none",
  fontWeight: 600,
};

const externalStyle = {
  ...anchorStyle,
  fontWeight: 500,
};

/**
 * Sitewide footer: internal navigation, deep stock links, XML sitemap, and external market references.
 */
export function SiteFooter({ t }) {
  return (
    <footer className="tp-site-footer no-print" style={footerStyle}>
      <div style={gridStyle}>
        <nav aria-label={t("FOOTER_NAV_SITE")}>
          <div style={headingStyle}>{t("FOOTER_NAV_SITE")}</div>
          <ul style={linkListStyle}>
            {SITE_LINKS.map(({ to, labelKey }) => (
              <li key={to}>
                <Link to={to} style={anchorStyle}>
                  {t(labelKey)}
                </Link>
              </li>
            ))}
            <li>
              <a href="/sitemap.xml" style={anchorStyle}>
                {t("FOOTER_SITEMAP")}
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("FOOTER_NAV_STOCKS")}>
          <div style={headingStyle}>{t("FOOTER_NAV_STOCKS")}</div>
          <ul style={linkListStyle}>
            {FOOTER_STOCK_LINKS.map(({ ticker, labelKey }) => (
              <li key={ticker}>
                <Link to={`/stock/${encodeURIComponent(ticker)}`} style={anchorStyle}>
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("FOOTER_NAV_EXTERNAL")}>
          <div style={headingStyle}>{t("FOOTER_NAV_EXTERNAL")}</div>
          <ul style={linkListStyle}>
            {EXTERNAL_MARKET_LINKS.map(({ href, labelKey }) => (
              <li key={href}>
                <a href={href} style={externalStyle} target="_blank" rel="noopener noreferrer">
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p style={{ margin: 0, textAlign: "center", fontSize: 11 }}>© TruePrice.Cash</p>
    </footer>
  );
}
