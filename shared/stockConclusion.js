/**
 * Stock-page conclusion.
 *
 * Applicable fair values are combined with the median. A method is left out
 * when it does not fit the company:
 *   equity  — ROE above 40%, or negative equity
 *   DCF     — free cash flow negative, or erratic (two or more drops of 25%+ in the last five years)
 *   earnings — net income negative
 * EV and P/S stay whenever the per-share value is positive.
 *
 * Valuation is price ÷ median: ≤ 0.85 undervalued, through 1.15 fairly valued, above that overvalued.
 * Quality passes with at least 5 of 6 checks, and ROIC above WACC is mandatory.
 * The page does not know whether the visitor owns the stock, so the decision is always two lines.
 */

const ENTRY_RATIO = 0.85;
const FAIR_RATIO = 1.15;
const ROE_EXCLUDE_ABOVE = 40;
const DEBT_MAX = 3;
const QUALITY_PASS_MIN = 5;
const FCF_LOOKBACK = 5;
const FCF_DROP = -0.25;

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function round2(n) {
  const x = num(n);
  if (x == null) return null;
  return Math.round(x * 100) / 100;
}

/** FMP sends 0.5197 or 51.97. Ratios up to 3 are treated as fractions. */
function parseWidePct(value) {
  const n = num(value);
  if (n == null) return null;
  const pct = Math.abs(n) <= 3 ? n * 100 : n;
  if (pct <= -100 || pct > 400) return null;
  return pct;
}

/** FMP sends 0.0975 or 9.75. Values up to 1 are treated as fractions. */
function parseWaccPct(value) {
  const n = num(value);
  if (n == null || n === 0) return null;
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  if (pct <= 0 || pct > 80) return null;
  return pct;
}

function positive(value) {
  const n = num(value);
  return n != null && n > 0 ? n : null;
}

function median(values) {
  const arr = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2) return arr[mid];
  return (arr[mid - 1] + arr[mid]) / 2;
}

/**
 * @returns {{ exclude: boolean, reason: "fcf_negative"|"fcf_erratic"|null }}
 */
export function assessFcf(series) {
  const values = (Array.isArray(series) ? series : []).map(num).filter((n) => n != null);
  if (!values.length) return { exclude: false, reason: null };
  const recent = values.slice(-FCF_LOOKBACK);
  if (recent.some((v) => v <= 0)) return { exclude: true, reason: "fcf_negative" };
  let largeDrops = 0;
  for (let i = 1; i < recent.length; i += 1) {
    const prev = recent[i - 1];
    if (prev === 0) continue;
    const change = (recent[i] - prev) / Math.abs(prev);
    if (change <= FCF_DROP) largeDrops += 1;
  }
  if (largeDrops >= 2) return { exclude: true, reason: "fcf_erratic" };
  return { exclude: false, reason: null };
}

function classifyPlain(key, value) {
  const n = positive(value);
  return {
    key,
    value: n,
    included: n != null,
    pending: false,
    reason: null,
  };
}

function classifyDcf({ value, fcfSeries, settled }) {
  const display = num(value);
  if (!settled) {
    return { key: "dcf", value: positive(display), included: false, pending: true, reason: null };
  }
  const fcf = assessFcf(fcfSeries);
  if (fcf.exclude) {
    return { key: "dcf", value: display, included: false, pending: false, reason: fcf.reason };
  }
  const n = positive(display);
  return { key: "dcf", value: n ?? display, included: n != null, pending: false, reason: null };
}

function classifyEarnings({ value, netIncome, settled }) {
  const display = num(value);
  if (!settled) {
    return { key: "earnings", value: positive(display), included: false, pending: true, reason: null };
  }
  const income = num(netIncome);
  if (income != null && income < 0) {
    return { key: "earnings", value: display, included: false, pending: false, reason: "earnings_negative" };
  }
  const n = positive(display);
  return { key: "earnings", value: n ?? display, included: n != null, pending: false, reason: null };
}

function classifyEquity({ value, roe, totalEquity, settled }) {
  const display = num(value);
  const equityNegative = (num(totalEquity) != null && num(totalEquity) < 0) || (display != null && display < 0);
  const roePct = parseWidePct(roe);
  if (!settled && !equityNegative) {
    return { key: "equity", value: positive(display), included: false, pending: true, reason: null };
  }
  if (roePct != null && roePct > ROE_EXCLUDE_ABOVE) {
    return { key: "equity", value: display, included: false, pending: false, reason: "equity_roe" };
  }
  if (equityNegative) {
    return { key: "equity", value: display, included: false, pending: false, reason: "equity_negative" };
  }
  const n = positive(display);
  return { key: "equity", value: n ?? display, included: n != null, pending: false, reason: null };
}

function valuationBand(ratio) {
  if (ratio <= ENTRY_RATIO) return "undervalued";
  if (ratio <= FAIR_RATIO) return "fair";
  return "overvalued";
}

function decide(qualityPass, valuation) {
  if (!valuation) return { owners: null, buyers: null };
  if (!qualityPass) return { owners: "hold_review", buyers: "wait_trap" };
  if (valuation === "undervalued") return { owners: "invest_add", buyers: "invest" };
  if (valuation === "fair") return { owners: "hold", buyers: "wait" };
  return { owners: "hold_dont_add", buyers: "wait" };
}

function confidenceFrom(values, mid) {
  if (!values.length || mid == null || mid <= 0) return { band: null, spreadPct: null, single: false };
  const spread = (Math.max(...values) - Math.min(...values)) / mid;
  const spreadPct = Math.round(spread * 100);
  let band = "low";
  if (spreadPct < 20) band = "high";
  else if (spreadPct <= 40) band = "medium";
  return { band, spreadPct, single: values.length === 1 };
}

/**
 * @param {object} input
 * @param {boolean} [input.dcfSettled]
 * @param {boolean} [input.earningsSettled]
 * @param {boolean} [input.equitySettled]
 * @param {boolean} [input.fcfSettled]
 */
export function buildStockConclusion(input = {}) {
  const price = positive(input.price);
  const fcfSettled = input.fcfSettled !== false;
  const dcfSettled = input.dcfSettled !== false && fcfSettled;
  const methods = [
    classifyDcf({
      value: input.dcf,
      fcfSeries: input.fcfSeries,
      settled: dcfSettled,
    }),
    classifyPlain("ev", input.fairEV),
    classifyPlain("ps", input.fairPS),
    classifyEarnings({
      value: input.fairPE,
      netIncome: input.netIncome,
      settled: input.earningsSettled !== false,
    }),
    classifyEquity({
      value: input.equityPerShare,
      roe: input.roe,
      totalEquity: input.totalEquity,
      settled: input.equitySettled !== false,
    }),
  ];

  const included = methods.filter((m) => m.included && m.value != null);
  const includedValues = included.map((m) => m.value);
  const mid = median(includedValues);
  const ratio = mid != null && price != null ? price / mid : null;
  const valuation = ratio != null ? valuationBand(ratio) : null;
  const aboveCount = price == null ? 0 : includedValues.filter((v) => v > price).length;

  const roicPct = parseWidePct(input.roic);
  const waccPct = parseWaccPct(input.wacc);
  const trends = input.trends || {};
  const netDebt = num(input.netDebtToEbitda);
  const checks = [
    { key: "roic", met: roicPct != null && waccPct != null && roicPct > waccPct, roicPct, waccPct },
    { key: "rev", met: trends.rev === true },
    { key: "op", met: trends.op === true },
    { key: "net", met: trends.net === true },
    { key: "fcf", met: trends.fcf === true },
    { key: "debt", met: netDebt != null && netDebt < DEBT_MAX, netDebtToEbitda: netDebt },
  ];
  const qualityScore = checks.filter((c) => c.met).length;
  const roicPass = checks[0].met;
  const qualityPass = qualityScore >= QUALITY_PASS_MIN && roicPass;
  const decision = decide(qualityPass, valuation);
  const confidence = confidenceFrom(includedValues, mid);

  return {
    methods,
    price,
    median: mid,
    medianDisplay: round2(mid),
    ratio,
    ratioDisplay: ratio == null ? null : round2(ratio),
    premiumPct: ratio == null ? null : Math.round((ratio - 1) * 100),
    valuation,
    aboveCount,
    applicableCount: included.length,
    entryPrice: mid == null ? null : round2(mid * ENTRY_RATIO),
    fairValueToEnter: price == null ? null : round2(price / ENTRY_RATIO),
    quality: {
      pass: qualityPass,
      score: qualityScore,
      total: checks.length,
      roicPass,
      checks,
    },
    owners: decision.owners,
    buyers: decision.buyers,
    confidence,
  };
}

function money(n) {
  const x = round2(n);
  if (x == null) return null;
  return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function joinAnd(items, lang) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (lang === "ar") return list.join(" و");
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

const TREND_LABELS = {
  en: { rev: "revenue", op: "operating income", net: "net income", fcf: "free cash flow" },
  ar: { rev: "الإيرادات", op: "الدخل التشغيلي", net: "صافي الربح", fcf: "التدفق النقدي الحر" },
};

function trendClause(checks, lang) {
  const labels = TREND_LABELS[lang] || TREND_LABELS.en;
  const keys = ["rev", "op", "net", "fcf"];
  const up = keys.filter((key) => checks.find((c) => c.key === key)?.met);
  const down = keys.filter((key) => !up.includes(key));
  if (!up.length) {
    return lang === "ar"
      ? "الإيرادات والدخل التشغيلي وصافي الربح والتدفق النقدي الحر ليست في ارتفاع"
      : "revenue, operating income, net income and free cash flow are not rising";
  }
  if (!down.length) {
    return lang === "ar"
      ? "الإيرادات والدخل التشغيلي وصافي الربح والتدفق النقدي الحر كلها في ارتفاع"
      : "revenue, operating income, net income and free cash flow are all rising";
  }
  const upText = joinAnd(up.map((key) => labels[key]), lang);
  const downText = joinAnd(down.map((key) => labels[key]), lang);
  if (lang === "ar") return `${upText} في ارتفاع، بينما ${downText} ليست كذلك`;
  const upVerb = up.length > 1 ? "are" : "is";
  const downVerb = down.length > 1 ? "are" : "is";
  return `${upText} ${upVerb} rising, while ${downText} ${downVerb} not`;
}

function supportPhrase(count, total, lang) {
  if (lang === "ar") {
    if (!total) return "لا توجد طريقة تقييم منطبقة";
    if (count === 0) return `لا تدعم أي طريقة من طرقنا المنطبقة (${total}) سعر اليوم`;
    if (count === total) return `كل الطرق المنطبقة (${total}) تدعم سعر اليوم`;
    return `${count} من ${total} طرق منطبقة تدعم سعر اليوم`;
  }
  if (!total) return "no valuation method applies";
  if (count === 0) {
    const noun = total === 1 ? "method supports" : "methods support";
    return `none of our ${total} applicable valuation ${noun} today's price`;
  }
  if (count === total) {
    return total === 1
      ? "the only applicable valuation method supports today's price"
      : `all ${total} applicable valuation methods support today's price`;
  }
  const verb = count === 1 ? "supports" : "support";
  return `${count} of our ${total} applicable valuation methods ${verb} today's price`;
}

function pctText(pct, { whole = false } = {}) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (whole && Math.abs(pct) >= 10) return `${Math.round(pct)}%`;
  return `${pct.toFixed(2)}%`;
}

const EXCLUDE_LABELS = {
  en: {
    equity_roe: "equity fair value (ROE above 40%)",
    equity_negative: "equity fair value (negative equity)",
    fcf_negative: "DCF (free cash flow is negative)",
    fcf_erratic: "DCF (free cash flow is erratic)",
    earnings_negative: "earnings fair value (net income is negative)",
  },
  ar: {
    equity_roe: "القيمة العادلة لحقوق الملكية (العائد على حقوق الملكية أعلى من 40%)",
    equity_negative: "القيمة العادلة لحقوق الملكية (حقوق الملكية سالبة)",
    fcf_negative: "DCF (التدفق النقدي الحر سالب)",
    fcf_erratic: "DCF (التدفق النقدي الحر متذبذب)",
    earnings_negative: "القيمة العادلة للأرباح (صافي الربح سالب)",
  },
};

/**
 * Sentences for the investment summary. Numbers use western digits in both languages.
 */
export function conclusionCopy(result, { lang = "en", company, currency = "USD", earningsLabel = null } = {}) {
  const isAr = lang === "ar";
  const name = String(company || "").trim() || (isAr ? "هذه الشركة" : "This company");
  const ccy = currency || "USD";
  const checks = result?.quality?.checks || [];
  const roic = checks.find((c) => c.key === "roic");
  const debt = checks.find((c) => c.key === "debt");
  const qualityPass = Boolean(result?.quality?.pass);
  const score = result?.quality?.score ?? 0;
  const totalChecks = result?.quality?.total ?? 6;

  const ownerWord = isAr
    ? { invest_add: "أضف", hold: "أبقِ", hold_dont_add: "أبقِ", hold_review: "راجع" }
    : { invest_add: "ADD", hold: "HOLD", hold_dont_add: "HOLD", hold_review: "REVIEW" };
  const buyerWord = isAr
    ? { invest: "استثمر", wait: "انتظر", wait_trap: "انتظر" }
    : { invest: "INVEST", wait: "WAIT", wait_trap: "WAIT" };

  const verdict =
    result?.owners && result?.buyers
      ? isAr
        ? `${ownerWord[result.owners]} إن كنت تملكه · ${buyerWord[result.buyers]} إن لم تكن`
        : `${ownerWord[result.owners]} if you own it · ${buyerWord[result.buyers]} if you don't`
      : null;

  const qualityLine = isAr
    ? `${qualityPass ? "اجتياز الجودة" : "لم تجتز الجودة"} · ${score}/${totalChecks}${
        !qualityPass && score >= QUALITY_PASS_MIN && !result?.quality?.roicPass
          ? " · يجب أن يتجاوز العائد على رأس المال تكلفته"
          : ""
      }`
    : `Quality ${qualityPass ? "pass" : "fail"} · ${score}/${totalChecks}${
        !qualityPass && score >= QUALITY_PASS_MIN && !result?.quality?.roicPass
          ? " · ROIC above WACC is required"
          : ""
      }`;

  let valuationLine = null;
  if (result?.valuation && result.ratioDisplay != null) {
    const ratioBit = `${result.ratioDisplay.toFixed(2)}×`;
    const gap = Math.abs(result.premiumPct ?? 0);
    if (result.valuation === "overvalued") {
      valuationLine = isAr
        ? `مبالغ فيه · ${ratioBit} · أعلى من القيمة العادلة بنسبة ${gap}%`
        : `Overvalued · ${ratioBit} · ${gap}% above fair value`;
    } else if (result.valuation === "undervalued") {
      valuationLine = isAr
        ? `أقل من القيمة · ${ratioBit} · أدنى من القيمة العادلة بنسبة ${gap}%`
        : `Undervalued · ${ratioBit} · ${gap}% below fair value`;
    } else {
      valuationLine = isAr ? `تقييم عادل · ${ratioBit}` : `Fairly valued · ${ratioBit}`;
    }
  } else {
    valuationLine = isAr ? "التقييم غير متاح" : "Valuation unavailable";
  }

  const medianLine =
    result?.medianDisplay != null
      ? isAr
        ? `وسيط القيمة العادلة ${money(result.medianDisplay)} ${ccy} · ${result.aboveCount} من ${result.applicableCount} طرق أعلى من السعر`
        : `Median fair value ${money(result.medianDisplay)} ${ccy} · ${result.aboveCount} of ${result.applicableCount} methods above the price`
      : null;

  const roicPct = pctText(roic?.roicPct, { whole: true });
  const waccPct = pctText(roic?.waccPct);
  let roicClause = null;
  if (roicPct && waccPct) {
    if (roic?.met) {
      roicClause = isAr
        ? `تحقق ${roicPct} على رأس المال المستثمر مقابل تكلفة رأس مال ${waccPct}`
        : `It earns ${roicPct} on invested capital against a ${waccPct} cost of capital`;
    } else {
      roicClause = isAr
        ? `العائد على رأس المال المستثمر ${roicPct} وهو أدنى من تكلفة رأس المال ${waccPct}`
        : `Return on invested capital is ${roicPct}, below a ${waccPct} cost of capital`;
    }
  }

  const trends = trendClause(checks, isAr ? "ar" : "en");
  const allTrendsUp = ["rev", "op", "net", "fcf"].every((key) => checks.find((c) => c.key === key)?.met);
  let debtClause = null;
  if (debt?.netDebtToEbitda != null) {
    const multiple = `${debt.netDebtToEbitda.toFixed(2)}×`;
    if (debt.met) {
      debtClause = isAr ? `الدين منخفض عند ${multiple} EBITDA.` : `Debt is low at ${multiple} EBITDA.`;
    } else {
      debtClause = isAr ? `صافي الدين ${multiple} EBITDA.` : `Net debt is ${multiple} EBITDA.`;
    }
  }

  const sentences = [];
  sentences.push(isAr ? `${name} ${qualityPass ? "شركة عالية الجودة." : "لا تجتاز بوابة الجودة."}` : qualityPass ? `${name} is a high-quality business.` : `${name} does not clear the quality bar.`);
  if (roicClause && allTrendsUp) {
    sentences.push(isAr ? `${roicClause}، و${trends}.` : `${roicClause}, and ${trends}.`);
  } else {
    if (roicClause) sentences.push(`${roicClause}.`);
    if (trends) {
      const standalone = trends.charAt(0).toUpperCase() + trends.slice(1);
      sentences.push(`${standalone}.`);
    }
  }
  if (debtClause) sentences.push(debtClause);

  if (result?.valuation && result.price != null && result.medianDisplay != null) {
    const support = supportPhrase(result.aboveCount, result.applicableCount, isAr ? "ar" : "en");
    const px = `${money(result.price)} ${ccy}`;
    const med = `${money(result.medianDisplay)} ${ccy}`;
    const gap = Math.abs(result.premiumPct ?? 0);
    if (result.valuation === "overvalued") {
      const lead = qualityPass ? (isAr ? "لكن عند" : "But at") : isAr ? "عند" : "At";
      sentences.push(
        isAr
          ? `${lead} ${px}، السعر أعلى من وسيط القيمة العادلة ${med} بنسبة ${gap}%، و${support}.`
          : `${lead} ${px}, the price is ${gap}% above our median fair value of ${med}, and ${support}.`
      );
    } else if (result.valuation === "undervalued") {
      sentences.push(
        isAr
          ? `عند ${px}، السعر أدنى من وسيط القيمة العادلة ${med} بنسبة ${gap}%، و${support}.`
          : `At ${px}, the price is ${gap}% below our median fair value of ${med}, and ${support}.`
      );
    } else {
      sentences.push(
        isAr
          ? `عند ${px}، السعر قريب من وسيط القيمة العادلة ${med} (${result.ratioDisplay.toFixed(2)}×)، و${support}.`
          : `At ${px}, the price is close to our median fair value of ${med} (${result.ratioDisplay.toFixed(2)}×), and ${support}.`
      );
    }
  }

  const excluded = (result?.methods || []).filter((m) => m.reason && !m.included && !m.pending);
  const excludeLabels = EXCLUDE_LABELS[isAr ? "ar" : "en"];
  const excludedLine = excluded.length
    ? isAr
      ? `مستبعد من الوسيط: ${excluded.map((m) => excludeLabels[m.reason] || m.reason).join("؛ ")}.`
      : `Excluded from the median: ${excluded.map((m) => excludeLabels[m.reason] || m.reason).join("; ")}.`
    : null;

  const entry =
    result?.entryPrice != null
      ? isAr
        ? `نطاق الدخول: ${money(result.entryPrice)} ${ccy} أو أقل.`
        : `Entry zone: ${money(result.entryPrice)} ${ccy} or below.`
      : null;
  const entryAlt =
    result?.valuation && result.valuation !== "undervalued" && result.fairValueToEnter != null
      ? isAr
        ? `أو يجب أن ترتفع القيمة العادلة إلى ${money(result.fairValueToEnter)} ${ccy} عند سعر اليوم.`
        : `Or fair value must rise to ${money(result.fairValueToEnter)} ${ccy} at today's price.`
      : null;
  const recheck = result?.medianDisplay != null
    ? earningsLabel
      ? isAr
        ? `إعادة الفحص: بعد إعلان الأرباح في ${earningsLabel}.`
        : `Re-check: after earnings on ${earningsLabel}.`
      : isAr
        ? "إعادة الفحص: بعد إعلان الأرباح القادم."
        : "Re-check: after the next earnings report."
    : null;

  let confidence = null;
  if (result?.confidence?.band) {
    const because = {
      en: {
        low: "because the valuation methods disagree widely",
        medium: "because the valuation methods only partly agree",
        high: result.confidence.single
          ? "because only one applicable method is left, so there is no disagreement to measure"
          : "because the applicable methods cluster tightly",
      },
      ar: {
        low: "لأن طرق التقييم تختلف اختلافاً واسعاً",
        medium: "لأن طرق التقييم تتفق جزئياً فقط",
        high: result.confidence.single
          ? "لأن طريقة واحدة فقط تنطبق ولا يوجد خلاف لقياسه"
          : "لأن الطرق المنطبقة متقاربة",
      },
    }[isAr ? "ar" : "en"][result.confidence.band];
    const label = {
      en: { high: "High", medium: "Medium", low: "Low" },
      ar: { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" },
    }[isAr ? "ar" : "en"][result.confidence.band];
    confidence = isAr ? `الثقة: ${label}، ${because}.` : `Confidence: ${label}, ${because}.`;
  }

  return {
    verdict,
    qualityLine,
    valuationLine,
    medianLine,
    body: sentences.join(" "),
    excluded: excludedLine,
    entry,
    entryAlt,
    recheck,
    confidence,
  };
}
