/**
 * aiReportRenderer.js
 * Converts the Claude agent JSON report into a fully styled bilingual HTML page.
 * Both English and Arabic sections have their own Chart.js charts.
 * Updated for CFA Equity Asset Valuation top-down methodology.
 */

const flagIcon = { ok: "✅", warning: "⚠️", danger: "🚨" };
const flagColor = { ok: "#68d391", warning: "#f6c90e", danger: "#fc8181" };

function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableRows(items, keys) {
  return items
    .map((row) => `<tr>${keys.map((k) => `<td>${escHtml(row[k] ?? "")}</td>`).join("")}</tr>`)
    .join("");
}

function buildEnglishReport(en, charts, symbol) {
  const rec = en?.recommendation || {};
  const verdictClass = rec.verdict || "hold";
  // Support both new valuation.fairValue and old fairValue paths
  const fairValue = en?.valuation?.fairValue || en?.fairValue || {};
  const sectionNum = { n: 0, next() { return ++this.n; } };

  return `
<div dir="ltr" style="text-align:left;">

  <div class="report-header">
    <div class="report-symbol">${escHtml(symbol)}</div>
    <div class="report-title">${escHtml(en?.companyName || symbol)} — Investment Research Report</div>
    <div class="report-meta">TruePrice.Cash &nbsp;·&nbsp; AI Financial Analyst (CFA Methodology) &nbsp;·&nbsp; ${escHtml(en?.reportDate || "")} &nbsp;·&nbsp; Current Price: ${escHtml(en?.currentPrice || "")}</div>
    <div style="margin-top:10px;font-size:12px;color:#90cdf4;">📊 Top-Down Approach: Macro Economy → Industry → Company → Valuation</div>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">1. Executive Summary</h2>
    <p>${escHtml(en?.executiveSummary || "")}</p>
  </div>

  ${en?.macroContext ? `
  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">2. Macroeconomic &amp; Country Context</h2>
    <p>${escHtml(en.macroContext.economicEnvironment || "")}</p>
    ${en.macroContext.keyMacroFactors?.length ? `
    <h3 class="tp-ai-h3">Key Macro Factors</h3>
    <ul class="tp-ai-list">${en.macroContext.keyMacroFactors.filter(Boolean).map((f) => `<li>${escHtml(f)}</li>`).join("")}</ul>` : ""}
    ${en.macroContext.macroImpactOnCompany ? `<p><strong>Impact on Company:</strong> ${escHtml(en.macroContext.macroImpactOnCompany)}</p>` : ""}
  </div>` : ""}

  ${en?.industryAnalysis ? `
  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">3. Industry Analysis</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
      ${en.industryAnalysis.industryName ? `<span class="tp-ai-badge">${escHtml(en.industryAnalysis.industryName)}</span>` : ""}
      ${en.industryAnalysis.lifecycleStage ? `<span class="tp-ai-badge tp-ai-badge-blue">Lifecycle: ${escHtml(en.industryAnalysis.lifecycleStage)}</span>` : ""}
    </div>
    <p>${escHtml(en.industryAnalysis.competitiveDynamics || "")}</p>
    ${en.industryAnalysis.portersFiveForces ? `
    <h3 class="tp-ai-h3">Porter's Five Forces</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Force</th><th>Assessment</th></tr></thead>
      <tbody>
        <tr><td>Competitive Rivalry</td><td>${escHtml(en.industryAnalysis.portersFiveForces.competitiveRivalry || "")}</td></tr>
        <tr><td>Supplier Power</td><td>${escHtml(en.industryAnalysis.portersFiveForces.supplierPower || "")}</td></tr>
        <tr><td>Buyer Power</td><td>${escHtml(en.industryAnalysis.portersFiveForces.buyerPower || "")}</td></tr>
        <tr><td>Threat of Substitutes</td><td>${escHtml(en.industryAnalysis.portersFiveForces.threatOfSubstitutes || "")}</td></tr>
        <tr><td>Barriers to Entry</td><td>${escHtml(en.industryAnalysis.portersFiveForces.barrierToEntry || "")}</td></tr>
      </tbody>
    </table></div>` : ""}
    ${en.industryAnalysis.industryOutlook ? `<p><strong>Industry Outlook:</strong> ${escHtml(en.industryAnalysis.industryOutlook)}</p>` : ""}
  </div>` : ""}

  ${en?.companyAnalysis ? `
  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">4. Company Competitive Analysis</h2>
    <p>${escHtml(en.companyAnalysis.businessModel || "")}</p>
    ${en.companyAnalysis.competitiveAdvantages?.length ? `
    <h3 class="tp-ai-h3">Competitive Advantages</h3>
    <ul class="tp-ai-list">${en.companyAnalysis.competitiveAdvantages.filter(Boolean).map((a) => `<li>${escHtml(a)}</li>`).join("")}</ul>` : ""}
    ${en.companyAnalysis.managementAssessment ? `<p><strong>Management:</strong> ${escHtml(en.companyAnalysis.managementAssessment)}</p>` : ""}
    ${en.companyAnalysis.earningsQuality ? `<p><strong>Earnings Quality:</strong> ${escHtml(en.companyAnalysis.earningsQuality)}</p>` : ""}
  </div>` : ""}

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">5. Revenue &amp; Profitability Analysis</h2>
    <p>${escHtml(en?.revenueAnalysis || "")}</p>
    ${en?.margins ? `
    <h3 class="tp-ai-h3">Profitability Margins</h3>
    <div class="tp-ai-table-wrap">
    <table class="tp-ai-table">
      <thead><tr><th>Metric</th>${en.margins.years.map((y) => `<th>${escHtml(y)}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Gross Margin</td>${en.margins.grossMargin.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>
        <tr><td>Operating Margin</td>${en.margins.operatingMargin.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>
        <tr><td>Net Profit Margin</td>${en.margins.netMargin.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>
      </tbody>
    </table>
    </div>` : ""}

    ${en?.dupont ? `
    <h3 class="tp-ai-h3">DuPont ROE Decomposition</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Component</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Net Profit Margin</td><td>${escHtml(en.dupont.netMargin || "")}</td></tr>
        <tr><td>Asset Turnover</td><td>${escHtml(en.dupont.assetTurnover || "")}</td></tr>
        <tr><td>Equity Multiplier</td><td>${escHtml(en.dupont.equityMultiplier || "")}</td></tr>
        <tr><td><strong>ROE (Combined)</strong></td><td><strong>${escHtml(en.dupont.roe || "")}</strong></td></tr>
      </tbody>
    </table></div>
    <p>${escHtml(en.dupont.analysis || "")}</p>` : ""}

    <div class="tp-ai-charts-grid">
      <div class="tp-ai-chart-box">
        <div class="tp-ai-chart-title">Annual Revenue</div>
        <canvas id="enRevenueChart"></canvas>
      </div>
      <div class="tp-ai-chart-box">
        <div class="tp-ai-chart-title">Annual Operating Income</div>
        <canvas id="enOperatingChart"></canvas>
      </div>
      <div class="tp-ai-chart-box tp-ai-chart-full">
        <div class="tp-ai-chart-title">Annual Operating Cash Flow</div>
        <canvas id="enCashflowChart"></canvas>
      </div>
    </div>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">6. Balance Sheet Health</h2>
    ${en?.balanceSheet?.items ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Item</th><th>Prior Year</th><th>Latest Year</th><th>Change</th></tr></thead>
      <tbody>${tableRows(en.balanceSheet.items, ["label", "prior", "latest", "change"])}</tbody>
    </table></div>` : ""}
    <p>${escHtml(en?.balanceSheet?.analysis || "")}</p>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">7. Cash Flow Quality &amp; FCF Analysis</h2>
    ${en?.cashFlow?.items ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Item</th><th>Prior Year</th><th>Latest Year</th><th>Assessment</th></tr></thead>
      <tbody>${tableRows(en.cashFlow.items, ["label", "prior", "latest", "assessment"])}</tbody>
    </table></div>` : ""}
    ${en?.cashFlow?.fcffAnalysis ? `<p><strong>FCFF:</strong> ${escHtml(en.cashFlow.fcffAnalysis)}</p>` : ""}
    ${en?.cashFlow?.fcfeAnalysis ? `<p><strong>FCFE:</strong> ${escHtml(en.cashFlow.fcfeAnalysis)}</p>` : ""}
    <p>${escHtml(en?.cashFlow?.analysis || "")}</p>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">8. Key Financial Ratios</h2>
    ${en?.ratios ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Ratio</th><th>Value</th><th>Industry Avg</th><th>Assessment</th></tr></thead>
      <tbody>${tableRows(en.ratios, ["ratio", "value", "industryAvg", "assessment"])}</tbody>
    </table></div>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">9. Multi-Model Valuation (CFA Framework)</h2>

    ${en?.valuation?.fcfValuation ? `
    <h3 class="tp-ai-h3">Free Cash Flow Valuation</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Method</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>FCFF (Free Cash Flow to Firm)</td><td>${escHtml(en.valuation.fcfValuation.fcff || "")}</td></tr>
        <tr><td>FCFE (Free Cash Flow to Equity)</td><td>${escHtml(en.valuation.fcfValuation.fcfe || "")}</td></tr>
        <tr><td>Implied Fair Price</td><td><strong>${escHtml(en.valuation.fcfValuation.impliedPrice || "")}</strong></td></tr>
      </tbody>
    </table></div>
    <p>${escHtml(en.valuation.fcfValuation.methodology || "")}</p>` : ""}

    ${en?.valuation?.multiples?.length ? `
    <h3 class="tp-ai-h3">Market-Based Multiples Valuation</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Method</th><th>Implied Price</th><th>Basis</th></tr></thead>
      <tbody>${tableRows(en.valuation.multiples, ["method", "impliedPrice", "basis"])}</tbody>
    </table></div>` : ""}

    ${en?.valuation?.ddm?.applicable !== false && en?.valuation?.ddm ? `
    <h3 class="tp-ai-h3">Dividend Discount Model (Gordon Growth)</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Component</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Sustainable Growth Rate</td><td>${escHtml(en.valuation.ddm.sustainableGrowth || "")}</td></tr>
        <tr><td>Implied Price (DDM)</td><td><strong>${escHtml(en.valuation.ddm.impliedPrice || "")}</strong></td></tr>
      </tbody>
    </table></div>
    <p>${escHtml(en.valuation.ddm.methodology || "")}</p>` : ""}

    ${en?.valuation?.residualIncome ? `
    <h3 class="tp-ai-h3">Residual Income Assessment</h3>
    <p><strong>Cost of Equity:</strong> ${escHtml(en.valuation.residualIncome.costOfEquity || "")} &nbsp;|&nbsp;
       <strong>Residual Income:</strong> ${escHtml(en.valuation.residualIncome.residualIncome || "")}</p>
    <p>${escHtml(en.valuation.residualIncome.assessment || "")}</p>` : ""}

    <h3 class="tp-ai-h3">Fair Value Synthesis (Weighted Average)</h3>
    <p>${escHtml(fairValue.analysis || "")}</p>
    ${fairValue.weightedFairValue ? `<p class="tp-ai-fair-value-highlight">Weighted Fair Value: <strong>${escHtml(fairValue.weightedFairValue)}</strong></p>` : ""}
    ${fairValue.scenarios ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Scenario</th><th>Fair Value</th><th>vs Current Price</th><th>Probability</th><th>Key Assumptions</th></tr></thead>
      <tbody>${fairValue.scenarios.map((s) => `<tr>
        <td>${escHtml(s.scenario)}</td>
        <td>${escHtml(s.value)}</td>
        <td>${escHtml(s.vsCurrentPrice)}</td>
        <td>${escHtml(s.probability)}</td>
        <td>${escHtml(s.assumptions || "")}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">10. Business Future Outlook</h2>
    <h3 class="tp-ai-h3">Core Business Model</h3>
    <p>${escHtml(en?.futureOutlook?.coreBusinessModel || "")}</p>
    ${en?.futureOutlook?.growthDrivers?.length ? `
    <h3 class="tp-ai-h3">Growth Drivers</h3>
    <ul class="tp-ai-list">${en.futureOutlook.growthDrivers.filter(Boolean).map((d) => `<li>${escHtml(d)}</li>`).join("")}</ul>` : ""}
    ${en?.futureOutlook?.catalysts?.length ? `
    <h3 class="tp-ai-h3">Key Catalysts</h3>
    <ul class="tp-ai-list">${en.futureOutlook.catalysts.filter(Boolean).map((c) => `<li>${escHtml(c)}</li>`).join("")}</ul>` : ""}
    ${en?.futureOutlook?.disruptionRisks?.length ? `
    <h3 class="tp-ai-h3">Disruption Risks</h3>
    <ul class="tp-ai-list">${en.futureOutlook.disruptionRisks.filter(Boolean).map((r) => `<li>${escHtml(r)}</li>`).join("")}</ul>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">11. Financial Statement Red Flags (Beneish M-Score)</h2>
    ${en?.redFlags?.mScore ? `<p><strong>M-Score:</strong> ${escHtml(en.redFlags.mScore)} — ${escHtml(en.redFlags.mScoreInterpretation || "")}</p>` : ""}
    ${en?.redFlags?.indicators ? `
    <h3 class="tp-ai-h3">Beneish M-Score Analysis</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>Indicator</th><th>Observation</th><th>Status</th></tr></thead>
      <tbody>${en.redFlags.indicators.map((ind) => `
        <tr>
          <td>${escHtml(ind.indicator)}</td>
          <td>${escHtml(ind.observation)}</td>
          <td style="color:${flagColor[ind.status] || "#e8e8e8"}">${flagIcon[ind.status] || ""} ${escHtml(ind.status)}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>` : ""}
    <p>${escHtml(en?.redFlags?.summary || "")}</p>
    <p style="color:${flagColor[en?.redFlags?.verdict] || "#e8e8e8"};font-weight:bold;font-size:15px;">
      ${flagIcon[en?.redFlags?.verdict] || ""} ${escHtml(en?.redFlags?.verdictText || "")}
    </p>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">12. Investment Risks</h2>
    ${en?.risks?.length ? `
    <ul class="tp-ai-list">
      ${en.risks.map((r) => {
        const sevColor = r.severity === "high" ? "#fc8181" : r.severity === "medium" ? "#f6c90e" : "#68d391";
        return `<li><strong style="color:${sevColor}">[${escHtml((r.severity || "").toUpperCase())}]</strong> <strong>${escHtml(r.title)}:</strong> ${escHtml(r.description)}</li>`;
      }).join("")}
    </ul>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">13. Final Recommendation</h2>
    <div class="tp-ai-verdict tp-ai-verdict-${escHtml(verdictClass)}">
      <div class="tp-ai-verdict-label">${escHtml(rec.verdictLabel || rec.verdict || "")}</div>
      <div class="tp-ai-verdict-target">
        Price Target: <strong>${escHtml(rec.priceTarget || "")}</strong>
        &nbsp;|&nbsp; Upside/Downside: <strong>${escHtml(rec.upside || "")}</strong>
        &nbsp;|&nbsp; Time Horizon: <strong>${escHtml(rec.timeHorizon || "12 months")}</strong>
      </div>
    </div>
    <p>${escHtml(rec.justification || "")}</p>
    ${rec.keycatalysts?.length ? `
    <h3 class="tp-ai-h3">Key Catalysts to Watch</h3>
    <ul class="tp-ai-list">${rec.keycatalysts.filter(Boolean).map((c) => `<li>${escHtml(c)}</li>`).join("")}</ul>` : ""}
  </div>

  <div class="tp-ai-disclaimer">
    <strong>Disclaimer:</strong> This report is for informational purposes only and does not constitute investment advice.
    TruePrice.Cash is not regulated by the Saudi Capital Market Authority (CMA).
    Always consult a licensed financial advisor before making investment decisions.
  </div>

</div>`;
}

function buildArabicReport(ar, charts, symbol) {
  const rec = ar?.recommendation || {};
  const verdictClass = rec.verdict || "hold";
  // Support both new valuation.fairValue and old fairValue paths
  const fairValue = ar?.valuation?.fairValue || ar?.fairValue || {};

  return `
<div class="tp-ai-arabic" dir="rtl" style="text-align:right;">

  <div class="report-header" style="text-align:right;">
    <div class="report-symbol">${escHtml(symbol)}</div>
    <div class="report-title">${escHtml(ar?.companyName || symbol)} — تقرير البحث الاستثماري</div>
    <div class="report-meta">TruePrice.Cash &nbsp;·&nbsp; محلل مالي بالذكاء الاصطناعي (منهجية CFA) &nbsp;·&nbsp; ${escHtml(ar?.reportDate || "")} &nbsp;·&nbsp; السعر الحالي: ${escHtml(ar?.currentPrice || "")}</div>
    <div style="margin-top:10px;font-size:12px;color:#90cdf4;">📊 نهج من القمة إلى القاعدة: الاقتصاد الكلي ← القطاع ← الشركة ← التقييم</div>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">١. الملخص التنفيذي</h2>
    <p>${escHtml(ar?.executiveSummary || "")}</p>
  </div>

  ${ar?.macroContext ? `
  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٢. السياق الاقتصادي الكلي والبيئة البلدية</h2>
    <p>${escHtml(ar.macroContext.economicEnvironment || "")}</p>
    ${ar.macroContext.keyMacroFactors?.length ? `
    <h3 class="tp-ai-h3">العوامل الكلية الرئيسية</h3>
    <ul class="tp-ai-list">${ar.macroContext.keyMacroFactors.filter(Boolean).map((f) => `<li>${escHtml(f)}</li>`).join("")}</ul>` : ""}
    ${ar.macroContext.macroImpactOnCompany ? `<p><strong>الأثر على الشركة:</strong> ${escHtml(ar.macroContext.macroImpactOnCompany)}</p>` : ""}
  </div>` : ""}

  ${ar?.industryAnalysis ? `
  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٣. تحليل القطاع</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;justify-content:flex-end;">
      ${ar.industryAnalysis.industryName ? `<span class="tp-ai-badge">${escHtml(ar.industryAnalysis.industryName)}</span>` : ""}
      ${ar.industryAnalysis.lifecycleStage ? `<span class="tp-ai-badge tp-ai-badge-blue">مرحلة دورة الحياة: ${escHtml(ar.industryAnalysis.lifecycleStage)}</span>` : ""}
    </div>
    <p>${escHtml(ar.industryAnalysis.competitiveDynamics || "")}</p>
    ${ar.industryAnalysis.portersFiveForces ? `
    <h3 class="tp-ai-h3">القوى الخمس لبورتر</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>القوة</th><th>التقييم</th></tr></thead>
      <tbody>
        <tr><td>حدة المنافسة</td><td>${escHtml(ar.industryAnalysis.portersFiveForces.competitiveRivalry || "")}</td></tr>
        <tr><td>قوة الموردين</td><td>${escHtml(ar.industryAnalysis.portersFiveForces.supplierPower || "")}</td></tr>
        <tr><td>قوة المشترين</td><td>${escHtml(ar.industryAnalysis.portersFiveForces.buyerPower || "")}</td></tr>
        <tr><td>تهديد البدائل</td><td>${escHtml(ar.industryAnalysis.portersFiveForces.threatOfSubstitutes || "")}</td></tr>
        <tr><td>الحواجز أمام الدخول</td><td>${escHtml(ar.industryAnalysis.portersFiveForces.barrierToEntry || "")}</td></tr>
      </tbody>
    </table></div>` : ""}
    ${ar.industryAnalysis.industryOutlook ? `<p><strong>التوقعات القطاعية:</strong> ${escHtml(ar.industryAnalysis.industryOutlook)}</p>` : ""}
  </div>` : ""}

  ${ar?.companyAnalysis ? `
  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٤. التحليل التنافسي للشركة</h2>
    <p>${escHtml(ar.companyAnalysis.businessModel || "")}</p>
    ${ar.companyAnalysis.competitiveAdvantages?.length ? `
    <h3 class="tp-ai-h3">المزايا التنافسية</h3>
    <ul class="tp-ai-list">${ar.companyAnalysis.competitiveAdvantages.filter(Boolean).map((a) => `<li>${escHtml(a)}</li>`).join("")}</ul>` : ""}
    ${ar.companyAnalysis.managementAssessment ? `<p><strong>تقييم الإدارة:</strong> ${escHtml(ar.companyAnalysis.managementAssessment)}</p>` : ""}
    ${ar.companyAnalysis.earningsQuality ? `<p><strong>جودة الأرباح:</strong> ${escHtml(ar.companyAnalysis.earningsQuality)}</p>` : ""}
  </div>` : ""}

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٥. تحليل الإيرادات والربحية</h2>
    <p>${escHtml(ar?.revenueAnalysis || "")}</p>
    ${ar?.margins ? `
    <h3 class="tp-ai-h3">هوامش الربحية</h3>
    <div class="tp-ai-table-wrap">
    <table class="tp-ai-table">
      <thead><tr><th>المقياس</th>${ar.margins.years.map((y) => `<th>${escHtml(y)}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>هامش الربح الإجمالي</td>${ar.margins.grossMargin.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>
        <tr><td>هامش التشغيل</td>${ar.margins.operatingMargin.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>
        <tr><td>هامش صافي الربح</td>${ar.margins.netMargin.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>
      </tbody>
    </table>
    </div>` : ""}

    ${ar?.dupont ? `
    <h3 class="tp-ai-h3">تحليل دوبونت للعائد على حقوق الملكية</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>المكوّن</th><th>القيمة</th></tr></thead>
      <tbody>
        <tr><td>هامش صافي الربح</td><td>${escHtml(ar.dupont.netMargin || "")}</td></tr>
        <tr><td>معدل دوران الأصول</td><td>${escHtml(ar.dupont.assetTurnover || "")}</td></tr>
        <tr><td>مضاعف حقوق الملكية</td><td>${escHtml(ar.dupont.equityMultiplier || "")}</td></tr>
        <tr><td><strong>العائد على حقوق الملكية (المحصلة)</strong></td><td><strong>${escHtml(ar.dupont.roe || "")}</strong></td></tr>
      </tbody>
    </table></div>
    <p>${escHtml(ar.dupont.analysis || "")}</p>` : ""}

    <!-- Arabic Charts -->
    <div class="tp-ai-charts-grid" style="direction:ltr;">
      <div class="tp-ai-chart-box">
        <div class="tp-ai-chart-title" style="direction:rtl;">الإيرادات السنوية</div>
        <canvas id="arRevenueChart"></canvas>
      </div>
      <div class="tp-ai-chart-box">
        <div class="tp-ai-chart-title" style="direction:rtl;">الدخل التشغيلي السنوي</div>
        <canvas id="arOperatingChart"></canvas>
      </div>
      <div class="tp-ai-chart-box tp-ai-chart-full">
        <div class="tp-ai-chart-title" style="direction:rtl;">التدفق النقدي التشغيلي السنوي</div>
        <canvas id="arCashflowChart"></canvas>
      </div>
    </div>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٦. صحة الميزانية العمومية</h2>
    ${ar?.balanceSheet?.items ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>البند</th><th>السنة السابقة</th><th>أحدث سنة</th><th>التغيير</th></tr></thead>
      <tbody>${tableRows(ar.balanceSheet.items, ["label", "prior", "latest", "change"])}</tbody>
    </table></div>` : ""}
    <p>${escHtml(ar?.balanceSheet?.analysis || "")}</p>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٧. جودة التدفق النقدي وتحليل FCF</h2>
    ${ar?.cashFlow?.items ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>البند</th><th>السنة السابقة</th><th>أحدث سنة</th><th>التقييم</th></tr></thead>
      <tbody>${tableRows(ar.cashFlow.items, ["label", "prior", "latest", "assessment"])}</tbody>
    </table></div>` : ""}
    ${ar?.cashFlow?.fcffAnalysis ? `<p><strong>FCFF:</strong> ${escHtml(ar.cashFlow.fcffAnalysis)}</p>` : ""}
    ${ar?.cashFlow?.fcfeAnalysis ? `<p><strong>FCFE:</strong> ${escHtml(ar.cashFlow.fcfeAnalysis)}</p>` : ""}
    <p>${escHtml(ar?.cashFlow?.analysis || "")}</p>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٨. النسب المالية الرئيسية</h2>
    ${ar?.ratios ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>النسبة</th><th>القيمة</th><th>متوسط الصناعة</th><th>التقييم</th></tr></thead>
      <tbody>${tableRows(ar.ratios, ["ratio", "value", "industryAvg", "assessment"])}</tbody>
    </table></div>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">٩. التقييم متعدد النماذج (إطار CFA)</h2>

    ${ar?.valuation?.fcfValuation ? `
    <h3 class="tp-ai-h3">تقييم التدفق النقدي الحر</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>الطريقة</th><th>القيمة</th></tr></thead>
      <tbody>
        <tr><td>FCFF (التدفق النقدي الحر للشركة)</td><td>${escHtml(ar.valuation.fcfValuation.fcff || "")}</td></tr>
        <tr><td>FCFE (التدفق النقدي الحر للملكية)</td><td>${escHtml(ar.valuation.fcfValuation.fcfe || "")}</td></tr>
        <tr><td>السعر العادل المستنتج</td><td><strong>${escHtml(ar.valuation.fcfValuation.impliedPrice || "")}</strong></td></tr>
      </tbody>
    </table></div>
    <p>${escHtml(ar.valuation.fcfValuation.methodology || "")}</p>` : ""}

    ${ar?.valuation?.multiples?.length ? `
    <h3 class="tp-ai-h3">التقييم بالمضاعفات السوقية</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>الطريقة</th><th>السعر المستنتج</th><th>الأساس</th></tr></thead>
      <tbody>${tableRows(ar.valuation.multiples, ["method", "impliedPrice", "basis"])}</tbody>
    </table></div>` : ""}

    ${ar?.valuation?.ddm?.applicable !== false && ar?.valuation?.ddm ? `
    <h3 class="tp-ai-h3">نموذج خصم الأرباح (نمو جوردون)</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>المكوّن</th><th>القيمة</th></tr></thead>
      <tbody>
        <tr><td>معدل النمو المستدام</td><td>${escHtml(ar.valuation.ddm.sustainableGrowth || "")}</td></tr>
        <tr><td>السعر المستنتج (DDM)</td><td><strong>${escHtml(ar.valuation.ddm.impliedPrice || "")}</strong></td></tr>
      </tbody>
    </table></div>
    <p>${escHtml(ar.valuation.ddm.methodology || "")}</p>` : ""}

    ${ar?.valuation?.residualIncome ? `
    <h3 class="tp-ai-h3">تقييم الدخل المتبقي</h3>
    <p><strong>تكلفة حقوق الملكية:</strong> ${escHtml(ar.valuation.residualIncome.costOfEquity || "")} &nbsp;|&nbsp;
       <strong>الدخل المتبقي:</strong> ${escHtml(ar.valuation.residualIncome.residualIncome || "")}</p>
    <p>${escHtml(ar.valuation.residualIncome.assessment || "")}</p>` : ""}

    <h3 class="tp-ai-h3">تركيب القيمة العادلة (المتوسط المرجح)</h3>
    <p>${escHtml(fairValue.analysis || "")}</p>
    ${fairValue.weightedFairValue ? `<p class="tp-ai-fair-value-highlight">القيمة العادلة المرجحة: <strong>${escHtml(fairValue.weightedFairValue)}</strong></p>` : ""}
    ${fairValue.scenarios ? `
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>السيناريو</th><th>القيمة العادلة</th><th>مقابل السعر الحالي</th><th>الاحتمالية</th><th>الافتراضات</th></tr></thead>
      <tbody>${fairValue.scenarios.map((s) => `<tr>
        <td>${escHtml(s.scenario)}</td>
        <td>${escHtml(s.value)}</td>
        <td>${escHtml(s.vsCurrentPrice)}</td>
        <td>${escHtml(s.probability)}</td>
        <td>${escHtml(s.assumptions || "")}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">١٠. توقعات مستقبل الأعمال</h2>
    <h3 class="tp-ai-h3">نموذج الأعمال الأساسي</h3>
    <p>${escHtml(ar?.futureOutlook?.coreBusinessModel || "")}</p>
    ${ar?.futureOutlook?.growthDrivers?.length ? `
    <h3 class="tp-ai-h3">محركات النمو</h3>
    <ul class="tp-ai-list">${ar.futureOutlook.growthDrivers.filter(Boolean).map((d) => `<li>${escHtml(d)}</li>`).join("")}</ul>` : ""}
    ${ar?.futureOutlook?.catalysts?.length ? `
    <h3 class="tp-ai-h3">المحفزات الرئيسية</h3>
    <ul class="tp-ai-list">${ar.futureOutlook.catalysts.filter(Boolean).map((c) => `<li>${escHtml(c)}</li>`).join("")}</ul>` : ""}
    ${ar?.futureOutlook?.disruptionRisks?.length ? `
    <h3 class="tp-ai-h3">مخاطر الاضطراب</h3>
    <ul class="tp-ai-list">${ar.futureOutlook.disruptionRisks.filter(Boolean).map((r) => `<li>${escHtml(r)}</li>`).join("")}</ul>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">١١. إشارات الإنذار في البيانات المالية (Beneish M-Score)</h2>
    ${ar?.redFlags?.mScore ? `<p><strong>M-Score:</strong> ${escHtml(ar.redFlags.mScore)} — ${escHtml(ar.redFlags.mScoreInterpretation || "")}</p>` : ""}
    ${ar?.redFlags?.indicators ? `
    <h3 class="tp-ai-h3">تحليل Beneish M-Score</h3>
    <div class="tp-ai-table-wrap"><table class="tp-ai-table">
      <thead><tr><th>المؤشر</th><th>الملاحظة</th><th>الحالة</th></tr></thead>
      <tbody>${ar.redFlags.indicators.map((ind) => `
        <tr>
          <td>${escHtml(ind.indicator)}</td>
          <td>${escHtml(ind.observation)}</td>
          <td style="color:${flagColor[ind.status] || "#e8e8e8"}">${flagIcon[ind.status] || ""}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>` : ""}
    <p>${escHtml(ar?.redFlags?.summary || "")}</p>
    <p style="color:${flagColor[ar?.redFlags?.verdict] || "#e8e8e8"};font-weight:bold;font-size:15px;">
      ${flagIcon[ar?.redFlags?.verdict] || ""} ${escHtml(ar?.redFlags?.verdictText || "")}
    </p>
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">١٢. مخاطر الاستثمار</h2>
    ${ar?.risks?.length ? `
    <ul class="tp-ai-list">
      ${ar.risks.map((r) => {
        const sevColor = r.severity === "high" ? "#fc8181" : r.severity === "medium" ? "#f6c90e" : "#68d391";
        const sevAr = r.severity === "high" ? "عالية" : r.severity === "medium" ? "متوسطة" : "منخفضة";
        return `<li><strong style="color:${sevColor}">[${sevAr}]</strong> <strong>${escHtml(r.title)}:</strong> ${escHtml(r.description)}</li>`;
      }).join("")}
    </ul>` : ""}
  </div>

  <div class="tp-ai-section">
    <h2 class="tp-ai-h2">١٣. التوصية النهائية</h2>
    <div class="tp-ai-verdict tp-ai-verdict-${escHtml(verdictClass)}">
      <div class="tp-ai-verdict-label">${escHtml(rec.verdictLabel || rec.verdict || "")}</div>
      <div class="tp-ai-verdict-target">
        هدف السعر: <strong>${escHtml(rec.priceTarget || "")}</strong>
        &nbsp;|&nbsp; الارتفاع/الانخفاض: <strong>${escHtml(rec.upside || "")}</strong>
        &nbsp;|&nbsp; الأفق الزمني: <strong>${escHtml(rec.timeHorizon || "12 شهراً")}</strong>
      </div>
    </div>
    <p>${escHtml(rec.justification || "")}</p>
    ${(rec.keyatalysts || rec.keycatalysts)?.length ? `
    <h3 class="tp-ai-h3">المحفزات الرئيسية للمتابعة</h3>
    <ul class="tp-ai-list">${(rec.keyatalysts || rec.keycatalysts || []).filter(Boolean).map((c) => `<li>${escHtml(c)}</li>`).join("")}</ul>` : ""}
  </div>

  <div class="tp-ai-disclaimer" style="text-align:right;">
    <strong>إخلاء المسؤولية:</strong> هذا التقرير لأغراض معلوماتية فقط ولا يُعدّ نصيحة استثمارية.
    منصة TruePrice.Cash غير مرخصة من هيئة السوق المالية (CMA).
    يُرجى استشارة مستشار مالي مرخص قبل اتخاذ أي قرارات استثمارية.
  </div>

</div>`;
}

export function renderAiReport(report, symbol) {
  const charts = report.charts || {};
  const en = report.english || {};
  const ar = report.arabic || {};

  en.companyName = en.companyName || report.companyName || symbol;
  en.reportDate = en.reportDate || report.reportDate || new Date().toLocaleDateString("en-US");
  en.currentPrice = en.currentPrice || report.currentPrice || "";
  ar.companyName = ar.companyName || report.companyName || symbol;
  ar.reportDate = ar.reportDate || report.reportDate || new Date().toLocaleDateString("ar-SA");
  ar.currentPrice = ar.currentPrice || report.currentPrice || "";

  const chartYears = JSON.stringify(charts.years || []);
  const chartRevenue = JSON.stringify(charts.revenue || []);
  const chartOp = JSON.stringify(charts.operatingIncome || []);
  const chartCf = JSON.stringify(charts.operatingCashFlow || []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(symbol)} Investment Report — TruePrice.Cash</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, 'Segoe UI', sans-serif; background: #0a1628; color: #e8e8e8; }
.tp-ai-wrap { max-width: 960px; margin: 0 auto; padding: 40px 20px; }
.report-header { background: linear-gradient(135deg,#0d1f3c,#1a3c5e); border: 1px solid #c9a84c; border-radius: 12px; padding: 28px 32px; margin-bottom: 28px; }
.report-symbol { color: #c9a84c; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
.report-title { color: #fff; font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.report-meta { color: #a0aec0; font-size: 13px; }
.tp-ai-section { background: #0d1f3c; border: 1px solid #1e3a5f; border-radius: 10px; padding: 24px 28px; margin-bottom: 20px; }
.tp-ai-h2 { color: #c9a84c; font-size: 17px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #1e3a5f; }
.tp-ai-h3 { color: #90cdf4; font-size: 14px; margin: 14px 0 8px; }
.tp-ai-section p { color: #cbd5e0; line-height: 1.85; margin-bottom: 12px; font-size: 14px; }
.tp-ai-list { color: #cbd5e0; padding-left: 20px; line-height: 1.85; font-size: 14px; margin-bottom: 12px; }
.tp-ai-list li { margin-bottom: 6px; }
.tp-ai-arabic .tp-ai-list { padding-left: 0; padding-right: 20px; }
.tp-ai-table-wrap { overflow-x: auto; margin: 12px 0; }
.tp-ai-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.tp-ai-table th { background: #1a3c5e; color: #c9a84c; padding: 9px 12px; text-align: left; white-space: nowrap; }
.tp-ai-arabic .tp-ai-table th { text-align: right; }
.tp-ai-table td { padding: 9px 12px; border-bottom: 1px solid #1e3a5f; color: #cbd5e0; }
.tp-ai-table tr:hover td { background: #0f2744; }
.tp-ai-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
.tp-ai-chart-box { background: #071428; border: 1px solid #1e3a5f; border-radius: 10px; padding: 16px; }
.tp-ai-chart-full { grid-column: 1 / -1; }
.tp-ai-chart-title { color: #c9a84c; font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.tp-ai-verdict { border-radius: 10px; padding: 18px 24px; margin: 14px 0; text-align: center; }
.tp-ai-verdict-buy, .tp-ai-verdict-strong-buy { background: #1a4731; border: 1px solid #68d391; }
.tp-ai-verdict-hold { background: #3d3000; border: 1px solid #f6c90e; }
.tp-ai-verdict-sell, .tp-ai-verdict-strong-sell { background: #3d0000; border: 1px solid #fc8181; }
.tp-ai-verdict-label { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
.tp-ai-verdict-buy .tp-ai-verdict-label, .tp-ai-verdict-strong-buy .tp-ai-verdict-label { color: #68d391; }
.tp-ai-verdict-hold .tp-ai-verdict-label { color: #f6c90e; }
.tp-ai-verdict-sell .tp-ai-verdict-label, .tp-ai-verdict-strong-sell .tp-ai-verdict-label { color: #fc8181; }
.tp-ai-verdict-target { color: #e8e8e8; font-size: 14px; }
.tp-ai-lang-divider { border: none; border-top: 2px solid #c9a84c44; margin: 48px 0 32px; }
.tp-ai-lang-label { text-align: center; color: #c9a84c; font-size: 13px; margin-bottom: 32px; }
.tp-ai-disclaimer { background: #071428; border: 1px solid #c9a84c33; border-radius: 8px; padding: 16px 20px; font-size: 12px; color: #718096; margin-top: 32px; line-height: 1.7; }
.tp-ai-badge { background: #1a3c5e; color: #90cdf4; border: 1px solid #2d5a8c; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
.tp-ai-badge-blue { background: #0d2d4a; color: #c9a84c; border-color: #c9a84c44; }
.tp-ai-fair-value-highlight { background: #0d2d4a; border-left: 3px solid #c9a84c; padding: 10px 16px; border-radius: 6px; font-size: 15px; color: #fff; margin: 10px 0; }
.tp-ai-arabic .tp-ai-fair-value-highlight { border-left: none; border-right: 3px solid #c9a84c; }
@media (max-width: 600px) {
  .tp-ai-charts-grid { grid-template-columns: 1fr; }
  .tp-ai-chart-full { grid-column: 1; }
  .tp-ai-section { padding: 16px; }
}
</style>
</head>
<body>
<div class="tp-ai-wrap">

${buildEnglishReport(en, charts, symbol)}

<hr class="tp-ai-lang-divider">
<div class="tp-ai-lang-label">◆ النسخة العربية ◆</div>

${buildArabicReport(ar, charts, symbol)}

</div>

<script>
(function() {
  const years = ${chartYears};
  const revenue = ${chartRevenue};
  const opIncome = ${chartOp};
  const cashflow = ${chartCf};

  const gridColor = '#1e3a5f';
  const tickColor = '#a0aec0';

  const baseOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { color: tickColor }, grid: { color: gridColor } },
      x: { ticks: { color: tickColor }, grid: { display: false } }
    }
  };

  // ── English Charts ──────────────────────────────────────────
  if (document.getElementById('enRevenueChart')) {
    new Chart(document.getElementById('enRevenueChart'), {
      type: 'bar',
      data: { labels: years, datasets: [{ data: revenue, backgroundColor: '#c9a84c', borderRadius: 5 }] },
      options: baseOpts
    });
  }

  if (document.getElementById('enOperatingChart')) {
    new Chart(document.getElementById('enOperatingChart'), {
      type: 'bar',
      data: { labels: years, datasets: [{ data: opIncome, backgroundColor: '#1a3c5e', borderColor: '#90cdf4', borderWidth: 1, borderRadius: 5 }] },
      options: baseOpts
    });
  }

  if (document.getElementById('enCashflowChart')) {
    new Chart(document.getElementById('enCashflowChart'), {
      type: 'line',
      data: { labels: years, datasets: [{ data: cashflow, borderColor: '#68d391', backgroundColor: '#68d39122', borderWidth: 2, pointBackgroundColor: '#68d391', fill: true, tension: 0.4 }] },
      options: baseOpts
    });
  }

  // ── Arabic Charts (same data, Arabic labels in chart title divs) ──
  if (document.getElementById('arRevenueChart')) {
    new Chart(document.getElementById('arRevenueChart'), {
      type: 'bar',
      data: { labels: years, datasets: [{ data: revenue, backgroundColor: '#c9a84c', borderRadius: 5 }] },
      options: baseOpts
    });
  }

  if (document.getElementById('arOperatingChart')) {
    new Chart(document.getElementById('arOperatingChart'), {
      type: 'bar',
      data: { labels: years, datasets: [{ data: opIncome, backgroundColor: '#1a3c5e', borderColor: '#90cdf4', borderWidth: 1, borderRadius: 5 }] },
      options: baseOpts
    });
  }

  if (document.getElementById('arCashflowChart')) {
    new Chart(document.getElementById('arCashflowChart'), {
      type: 'line',
      data: { labels: years, datasets: [{ data: cashflow, borderColor: '#68d391', backgroundColor: '#68d39122', borderWidth: 2, pointBackgroundColor: '#68d391', fill: true, tension: 0.4 }] },
      options: baseOpts
    });
  }
})();
</script>
</body>
</html>`;
}
