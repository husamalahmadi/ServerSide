const MARKET_LABEL = {
  en: {
    us: "the US market (S&P 500)",
    sa: "TASI on the Saudi Exchange (Tadawul)",
    jp: "the Tokyo Stock Exchange",
    uk: "the London Stock Exchange (LSE)",
  },
  ar: {
    us: "السوق الأمريكي (S&P 500)",
    sa: "مؤشر تاسي في السوق السعودي (تداول)",
    jp: "بورصة طوكيو",
    uk: "بورصة لندن (LSE)",
  },
};

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pricePhrase(price, fairValue, currency, lang) {
  const p = fmtNum(price);
  const f = fmtNum(fairValue);
  if (!p || !f) return null;
  const diff = ((Number(fairValue) - Number(price)) / Number(price)) * 100;
  const discount = Number.isFinite(diff) ? Math.round(diff * 10) / 10 : null;
  if (lang === "ar") {
    if (discount == null) return `السعر الحالي ${p} ${currency} مقابل قيمة عادلة تقديرية ${f} ${currency}.`;
    if (discount > 2) return `السعر الحالي ${p} ${currency} أقل من القيمة العادلة التقديرية ${f} ${currency} (خصم تقريبي ${discount}%).`;
    if (discount < -2) return `السعر الحالي ${p} ${currency} أعلى من القيمة العادلة التقديرية ${f} ${currency} (علاوة تقريبية ${Math.abs(discount)}%).`;
    return `السعر الحالي ${p} ${currency} قريب من القيمة العادلة التقديرية ${f} ${currency}.`;
  }
  if (discount == null) return `The current price is ${p} ${currency} versus an estimated fair value of ${f} ${currency}.`;
  if (discount > 2) return `The current price of ${p} ${currency} sits below the estimated fair value of ${f} ${currency} (roughly ${discount}% discount).`;
  if (discount < -2) return `The current price of ${p} ${currency} trades above the estimated fair value of ${f} ${currency} (roughly ${Math.abs(discount)}% premium).`;
  return `The current price of ${p} ${currency} is close to the estimated fair value of ${f} ${currency}.`;
}

function trimDescription(text, maxLen = 900) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 400 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * Rich, crawlable stock profile narrative (English / Arabic).
 * Used on the live Stock Profile card and in server-rendered HTML fallback.
 */
export function buildStockNarrative({
  lang = "en",
  ticker,
  companyName,
  market = "us",
  industry = "",
  sector = "",
  currency = "USD",
  price,
  fairValue,
  companyDescription = "",
}) {
  const isAr = lang === "ar";
  const name = String(companyName || ticker || "").trim() || String(ticker);
  const sym = String(ticker || "").trim();
  const marketLabel = MARKET_LABEL[isAr ? "ar" : "en"][market] || market;
  const industryLabel = String(industry || "").trim();
  const sectorLabel = String(sector || "").trim();
  const valuationLine = pricePhrase(price, fairValue, currency, lang);

  const sections = [];

  if (isAr) {
    const overview = [
      `تحليل سهم ${name} (${sym}) على TruePrice.Cash يركز على مقارنة سعر السوق بالقيمة العادلة المبنية على البيانات المالية الأساسية، وليس على العناوين أو الزخم قصير الأجل.`,
      valuationLine,
      industryLabel
        ? `${name} مدرج في ${marketLabel} ويُصنّف ضمن قطاع ${industryLabel}${sectorLabel && sectorLabel !== industryLabel ? ` (${sectorLabel})` : ""}.`
        : `${name} مدرج في ${marketLabel} ضمن قائمة الأسهم التي نغطيها في TruePrice.Cash.`,
    ].filter(Boolean);

    const approach = [
      "نبدأ بتقدير DCF (التدفقات النقدية المخصومة) كمقياس رئيسي للقيمة الجوهرية، ثم نعرض طرق تقييم إضافية تشمل EV للسهم، ومضاعفات P/S وP/E، مع متوسط مركّب للقيمة العادلة.",
      "تُستمد البيانات من قوائم مالية سنوية (إيرادات، دخل تشغيلي، صافي دخل، حقوق مساهمين، وتدفق نقدي حر) ومؤشرات FMP الرئيسية، مع سعر مباشر من السوق عند التوفر.",
      "مخطط السعر مقابل القيمة العادلة يوضح مسار السهم الشهري بجانب القيمة العادلة السنوية المحسوبة بطريقة EV: (قيمة المؤسسة + النقد − الدين) ÷ الأسهم القائمة.",
    ];

    const onPage = [
      "يتضمن هذا التقرير: ملخصاً تنفيذياً، قيمة DCF العادلة، مخطط السعر مقابل القيمة العادلة، تحليل EV / P/S / P/E، مؤشرات مالية رئيسية، اتجاهات الإيرادات والربحية، حقوق الملكية والتدفق النقدي الحر، ومقارنة أقران القطاع عند الطلب.",
      "يمكنك استخدام الصفحة للبحث عن فجوة السعر عن القيمة، ومراجعة اتجاه الأرباح والتدفقات، ثم مقارنة السهم بشركات مماثلة في نفس الصناعة.",
      "هذا المحتوى تعليمي وبحثي فقط ولا يُعد توصية شراء أو بيع أو استثمار. تحقق دائماً من مصادرك وحدود تحمّل المخاطر قبل أي قرار.",
    ];

    sections.push({ id: "overview", heading: "نظرة عامة", paragraphs: overview });
    const desc = trimDescription(companyDescription);
    if (desc) sections.push({ id: "about", heading: `عن ${name}`, paragraphs: [desc] });
    sections.push({ id: "approach", heading: "منهجية التقييم", paragraphs: approach });
    sections.push({ id: "on-page", heading: "ما ستجده في هذه الصفحة", paragraphs: onPage });
  } else {
    const overview = [
      `${name} (${sym}) stock analysis on TruePrice.Cash compares live market pricing with fundamentals-based fair value — not headlines or short-term momentum.`,
      valuationLine,
      industryLabel
        ? `${name} is listed on ${marketLabel} and classified in the ${industryLabel} industry${sectorLabel && sectorLabel !== industryLabel ? ` (${sectorLabel} sector)` : ""}.`
        : `${name} is listed on ${marketLabel} and covered in the TruePrice.Cash stock catalog.`,
    ].filter(Boolean);

    const approach = [
      "We lead with a discounted cash flow (DCF) estimate as the flagship intrinsic-value view, then layer enterprise-value (EV), price-to-sales (P/S), and price-to-earnings (P/E) approaches with a blended fair-value average.",
      "Figures come from annual financial statements — revenue, operating income, net income, shareholders' equity, and free cash flow — plus key metrics from Financial Modeling Prep, with live quotes when available.",
      "The price-versus-fair-value chart plots monthly share prices against yearly EV-based fair value per share: (Enterprise Value + cash − debt) ÷ shares outstanding.",
    ];

    const onPage = [
      "This report includes an executive summary, DCF fair value, a price vs fair value chart, EV / P/S / P/E valuation rows, key financial metrics, revenue and income trends, equity and free cash flow charts, and optional same-industry peer comparison.",
      "Use the page to gauge whether the stock trades at a discount or premium to estimated value, review earnings and cash-flow direction, and compare the name with sector peers.",
      "All content is for education and research only — not buy, sell, or hold advice. Always verify data and align decisions with your own risk tolerance.",
    ];

    sections.push({ id: "overview", heading: "Overview", paragraphs: overview });
    const desc = trimDescription(companyDescription);
    if (desc) sections.push({ id: "about", heading: `About ${name}`, paragraphs: [desc] });
    sections.push({ id: "approach", heading: "Valuation approach", paragraphs: approach });
    sections.push({ id: "on-page", heading: "What you will find on this page", paragraphs: onPage });
  }

  const paragraphs = sections.flatMap((s) => s.paragraphs);
  return { sections, paragraphs };
}

/** Flat HTML paragraphs for crawler static fallback (no client JS). */
export function stockNarrativeToStaticHtml(narrative, escapeHtml) {
  if (!narrative?.sections?.length) return "";
  return narrative.sections
    .map((sec) => {
      const heading = escapeHtml(sec.heading);
      const body = sec.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n      ");
      return `<h2>${heading}</h2>\n      ${body}`;
    })
    .join("\n      ");
}
