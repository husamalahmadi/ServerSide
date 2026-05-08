const YF_BASE = "https://query2.finance.yahoo.com";

function getHostFromWebsite(website) {
  if (!website || typeof website !== "string") return null;
  try {
    const normalized = website.startsWith("http://") || website.startsWith("https://")
      ? website
      : `https://${website}`;
    const u = new URL(normalized);
    return u.hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

function pickCeoName(companyOfficers) {
  if (!Array.isArray(companyOfficers)) return null;
  const hit = companyOfficers.find((o) => /ceo|chief exec/i.test(String(o?.title || "")));
  return hit?.name || null;
}

async function fetchYahooJson(url) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Yahoo returned invalid JSON (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`Yahoo request failed (${res.status})`);
  }

  return data;
}

export async function yfPrice(yfSymbol) {
  const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d&includePrePost=false`;
  const data = await fetchYahooJson(url);
  const meta = data?.chart?.result?.[0]?.meta;

  if (!meta || meta.regularMarketPrice == null) {
    throw new Error(`Yahoo price payload missing for symbol: ${yfSymbol}`);
  }

  return {
    price: Number(meta.regularMarketPrice),
    currency: meta.currency,
  };
}

export async function yfProfileAndLogo(yfSymbol) {
  try {
    const url = `${YF_BASE}/v11/finance/quoteSummary/${encodeURIComponent(yfSymbol)}?modules=assetProfile%2CsummaryDetail%2CquoteType`;
    const data = await fetchYahooJson(url);
    const root = data?.quoteSummary?.result?.[0];

    if (!root) {
      throw new Error(`Yahoo profile payload missing for symbol: ${yfSymbol}`);
    }

    const quoteType = root.quoteType || {};
    const assetProfile = root.assetProfile || {};

    const website = assetProfile.website;
    const host = getHostFromWebsite(website);

    return {
      symbol: quoteType.symbol,
      name: quoteType.longName || quoteType.shortName,
      industry: assetProfile.industry,
      sector: assetProfile.sector,
      description: assetProfile.longBusinessSummary,
      city: assetProfile.city,
      country: assetProfile.country,
      CEO: pickCeoName(assetProfile.companyOfficers),
      website,
      phone: assetProfile.phone,
      logoUrl: host ? `https://logo.clearbit.com/${host}` : null,
    };
  } catch {
    return {};
  }
}
