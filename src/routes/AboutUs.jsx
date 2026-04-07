import React, { useMemo } from "react";
import { useI18n } from "../i18n.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";

export default function AboutUs() {
  const { lang, dir, t } = useI18n();
  usePageMeta({ title: t("ABOUT_US"), description: "TruePrice.Cash – " + t("ABOUT_US") + "." });

  const content = useMemo(
    () => ({
      en: {
        title: "About TruePrice.Cash",
        body: [
          "TruePrice.cash is built to help investors navigate equity markets with clear, fundamentals-driven tools.",
          "We estimate a stock’s fair value, highlight the gap between price and value, and summarize business performance by reading core financial statements—revenue, operating income, net income, total shareholders’ equity, and free cash flow.",
          "Our goal is to make financial analysis fast, consistent, and accessible, so investors can make better decisions with confidence.",
        ],
      },
      ar: {
        title: "حول TruePrice.Cash",
        body: [
          "تم تطوير TruePrice.cash لمساعدة المستثمرين على التنقل في أسواق الأسهم باستخدام أدوات مالية واضحة مبنية على أساسيات الشركات.",
          "نقدّم تقديراً للقيمة العادلة للسهم ونوضح الفجوة بين السعر والقيمة، مع تلخيص أداء الشركة عبر قراءة القوائم المالية الرئيسية مثل الإيرادات والدخل التشغيلي وصافي الدخل وإجمالي حقوق المساهمين والتدفق النقدي الحر.",
          "هدفنا هو جعل التحليل المالي أسرع وأكثر اتساقاً وأسهل وصولاً، لتمكين المستثمرين من اتخاذ قرارات أفضل بثقة.",
        ],
      },
    }),
    []
  );

  const L = content[lang] || content.en;

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", background: "var(--tp-bg, #f5f2eb)", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, position: "relative", zIndex: 1 }}>
        <PageHeader title="TruePrice.Cash" subtitle={t("ABOUT_US")}>
          <PillLink to="/" ariaLabel={t("DASHBOARD")}>TruePrice.Cash</PillLink>
        </PageHeader>

        <div
          style={{
            marginTop: 16,
            background: "var(--tp-surface, #fff)",
            border: "1px solid var(--tp-border, #ddd8cc)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
            lineHeight: 1.75,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "var(--tp-ink, #1a1a14)",
            fontFamily: "'Playfair Display', serif" }}>{L.title}</div>
          <div style={{ marginTop: 10, color: "var(--tp-ink, #1a1a14)" }}>
            {L.body.map((p) => (
              <p key={p} style={{ margin: "10px 0" }}>
                {p}
              </p>
            ))}
          </div>
        </div>

        {import.meta.env.VITE_PUBLIC_TRAFFIC_DASHBOARD_URL ? (
          <div
            style={{
              marginTop: 16,
              textAlign: "center",
              fontSize: 13,
              color: "var(--tp-muted, #8a8578)",
            }}
          >
            <a
              href={import.meta.env.VITE_PUBLIC_TRAFFIC_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--tp-ink, #1a1a14)", fontWeight: 600 }}
            >
              {lang === "ar" ? "لوحة الزيارات والمقاييس (للمستثمرين)" : "Public traffic & metrics (investors)"}
            </a>
          </div>
        ) : null}

        <footer
          style={{
            marginTop: 24,
            padding: "14px 4px",
            textAlign: "center",
            color: "var(--tp-muted, #8a8578)",
            fontSize: 12,
          }}
        >
          © TruePrice.Cash
        </footer>
      </div>
    </div>
  );
}