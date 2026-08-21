import React, { useMemo } from "react";
import { useI18n } from "../i18n.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";

function PillarIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };
  switch (name) {
    case "vision":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "mission":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
    case "values":
      return (
        <svg {...common}>
          <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "fair":
      return (
        <svg {...common}>
          <path d="M12 3v18M6 7h12M6 7l-3 6a3 3 0 006 0L6 7zm12 0l-3 6a3 3 0 006 0l-3-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AboutUs() {
  const { lang, dir, t } = useI18n();
  usePageMeta({
    documentTitle: t("SEO_TITLE_ABOUT"),
    metaDescription: t("SEO_DESC_ABOUT"),
    pathname: "/about",
  });

  const content = useMemo(
    () => ({
      en: {
        heroKicker: "Fair value, made clear",
        heroTitle: "Invest with conviction, not guesswork",
        heroLead:
          "TruePrice.Cash turns dense financial statements into a single, honest question: is this stock trading above or below what it is really worth? We bring fundamentals-driven fair value to investors across the US, Saudi (TASI), Tokyo, and London markets.",
        navAbout: "About us",
        navHowTo: "How to use",
        about: {
          kicker: "Who we are",
          title: "About TruePrice.Cash",
          lead:
            "We are a research platform that estimates the intrinsic, fair value of public companies and measures the gap between price and value—so investors can act on evidence instead of noise.",
          body: [
            "We read the core of every business—revenue, operating income, net income, shareholders’ equity, and free cash flow—and translate it into a clear valuation picture, including a discounted cash flow (DCF) estimate as our flagship metric.",
            "Our coverage spans the US, Saudi (TASI), Tokyo, and London markets, with a screener, market dashboards, and full company reports designed to be fast, consistent, and genuinely useful.",
          ],
          pillars: [
            {
              icon: "vision",
              title: "Our vision",
              text:
                "A world where every investor—regardless of background—can see the true worth of a company in seconds and invest with the same clarity as a professional analyst.",
            },
            {
              icon: "mission",
              title: "Our mission",
              text:
                "To make rigorous, fundamentals-based valuation fast, transparent, and accessible, turning complex financial statements into decisions investors can trust.",
            },
            {
              icon: "values",
              title: "Our values",
              text:
                "Honesty over hype, evidence over opinion, and clarity over complexity. We show the numbers as they are—including when a stock looks expensive.",
            },
          ],
        },
        howto: {
          kicker: "Get the most out of it",
          title: "How to use TruePrice.Cash",
          fairTitle: "First, what is fair value—and why it matters",
          fairLead:
            "Fair value is an estimate of what a company is genuinely worth based on its fundamentals, not its daily market price.",
          fairBody: [
            "Prices move on emotion, headlines, and momentum. Fair value moves on cash flows, earnings, and assets. When the market price sits well below fair value, you may have found a quality stock on sale; when it sits far above, caution is warranted.",
            "By comparing price to fair value, investors can focus on great businesses at sensible prices—the core discipline behind long-term, value-driven investing.",
          ],
          stepsTitle: "Navigating the site",
          steps: [
            {
              title: "Search any stock",
              text:
                "Use the search bar on the home page or in the top bar of any stock page. Filter by US, TASI, Tokyo, or London and start typing a ticker or company name to jump straight to a full report.",
            },
            {
              title: "Read the DCF fair value",
              text:
                "Every stock page opens with our flagship DCF fair value and how it compares to the current price—your fastest read on whether a stock is under- or over-valued.",
            },
            {
              title: "Screen for opportunities",
              text:
                "Open the Stock Screener to surface undervalued, large-cap, or market-specific ideas, then sort and filter to match your strategy.",
            },
            {
              title: "Track the markets",
              text:
                "Use the US and TASI market dashboards to follow performance, gainers, and stocks trading near their fair value across each market.",
            },
            {
              title: "Go deeper per company",
              text:
                "Within a report, review revenue, operating income, net income, equity, and free cash flow trends, plus peers and news, to confirm the story behind the number.",
            },
          ],
        },
      },
      ar: {
        heroKicker: "القيمة العادلة بوضوح",
        heroTitle: "استثمر بقناعة لا بالتخمين",
        heroLead:
          "تحوّل TruePrice.Cash القوائم المالية المعقّدة إلى سؤال واحد صادق: هل يتداول هذا السهم أعلى أم أدنى من قيمته الحقيقية؟ نقدّم القيمة العادلة المبنية على الأساسيات للمستثمرين في أسواق الولايات المتحدة والسعودية (تاسي) وطوكيو ولندن.",
        navAbout: "من نحن",
        navHowTo: "كيفية الاستخدام",
        about: {
          kicker: "من نحن",
          title: "حول TruePrice.Cash",
          lead:
            "نحن منصّة بحثية تُقدّر القيمة العادلة الجوهرية للشركات المدرجة وتقيس الفجوة بين السعر والقيمة، لتمكين المستثمرين من اتخاذ قراراتهم بناءً على الأدلة لا الضجيج.",
          body: [
            "نقرأ جوهر كل شركة — الإيرادات والدخل التشغيلي وصافي الدخل وحقوق المساهمين والتدفق النقدي الحر — ونترجمها إلى صورة واضحة للتقييم، تتضمّن تقدير التدفقات النقدية المخصومة (DCF) كمقياسنا الرئيسي.",
            "تشمل تغطيتنا أسواق الولايات المتحدة والسعودية (تاسي) وطوكيو ولندن، مع أداة فرز وأسواق تفاعلية وتقارير شركات كاملة صُمّمت لتكون سريعة ومتّسقة ومفيدة فعلاً.",
          ],
          pillars: [
            {
              icon: "vision",
              title: "رؤيتنا",
              text:
                "عالم يستطيع فيه كل مستثمر — مهما كانت خلفيته — أن يرى القيمة الحقيقية لأي شركة في ثوانٍ، وأن يستثمر بنفس وضوح المحلل المحترف.",
            },
            {
              icon: "mission",
              title: "مهمتنا",
              text:
                "جعل التقييم الدقيق المبني على الأساسيات سريعاً وشفافاً وسهل الوصول، وتحويل القوائم المالية المعقّدة إلى قرارات يثق بها المستثمر.",
            },
            {
              icon: "values",
              title: "قيمنا",
              text:
                "الصدق قبل المبالغة، والدليل قبل الرأي، والوضوح قبل التعقيد. نعرض الأرقام كما هي — حتى حين يبدو السهم مبالغاً في سعره.",
            },
          ],
        },
        howto: {
          kicker: "احصل على أقصى استفادة",
          title: "كيفية استخدام TruePrice.Cash",
          fairTitle: "أولاً، ما هي القيمة العادلة ولماذا تهمّ؟",
          fairLead:
            "القيمة العادلة هي تقدير لما تستحقه الشركة فعلياً بناءً على أساسياتها، وليس بناءً على سعرها اليومي في السوق.",
          fairBody: [
            "تتحرّك الأسعار بفعل العاطفة والأخبار والزخم، بينما تتحرّك القيمة العادلة بفعل التدفقات النقدية والأرباح والأصول. عندما يكون سعر السوق أدنى بكثير من القيمة العادلة، فقد تكون أمام سهم جيّد بسعر مخفّض؛ وعندما يكون أعلى بكثير، فالحذر مطلوب.",
            "بمقارنة السعر بالقيمة العادلة، يمكن للمستثمرين التركيز على الشركات الممتازة بأسعار معقولة — وهو جوهر الاستثمار طويل الأمد المبني على القيمة.",
          ],
          stepsTitle: "التنقّل في الموقع",
          steps: [
            {
              title: "ابحث عن أي سهم",
              text:
                "استخدم شريط البحث في الصفحة الرئيسية أو في الشريط العلوي لأي صفحة سهم. صفِّ حسب السوق (الولايات المتحدة، تاسي، طوكيو، لندن) وابدأ بكتابة الرمز أو اسم الشركة للانتقال مباشرةً إلى تقرير كامل.",
            },
            {
              title: "اقرأ القيمة العادلة (DCF)",
              text:
                "تبدأ كل صفحة سهم بقيمتنا العادلة الرئيسية المبنية على التدفقات النقدية المخصومة ومقارنتها بالسعر الحالي — أسرع طريقة لمعرفة ما إذا كان السهم مقوَّماً بأقل أو بأكثر من قيمته.",
            },
            {
              title: "افرز الفرص",
              text:
                "افتح أداة فرز الأسهم لإظهار الأسهم المقوَّمة بأقل من قيمتها أو الشركات الكبرى أو أفكار خاصة بسوق معيّن، ثم رتّب وصفِّ بما يناسب استراتيجيتك.",
            },
            {
              title: "تابع الأسواق",
              text:
                "استخدم لوحتي أداء السوق الأمريكي والسعودي لمتابعة الأداء والأسهم الأكثر ارتفاعاً والأسهم المتداولة قرب قيمتها العادلة في كل سوق.",
            },
            {
              title: "تعمّق في كل شركة",
              text:
                "داخل التقرير، راجع اتجاهات الإيرادات والدخل التشغيلي وصافي الدخل وحقوق المساهمين والتدفق النقدي الحر، إضافة إلى الشركات المنافسة والأخبار، لتأكيد القصة وراء الرقم.",
            },
          ],
        },
      },
    }),
    []
  );

  const L = content[lang] || content.en;

  return (
    <div className="tp-page tp-about-page" dir={dir} lang={lang}>
      <PageHeader title={L.about.title} subtitle={t("ABOUT_US")} />

      <section className="tp-about-hero" aria-label={L.heroTitle}>
        <span className="tp-about-hero-glow" aria-hidden />
        <span className="tp-about-hero-kicker">{L.heroKicker}</span>
        <h2 className="tp-about-hero-title">{L.heroTitle}</h2>
        <p className="tp-about-hero-lead">{L.heroLead}</p>
        <nav className="tp-about-nav" aria-label={L.navAbout + " / " + L.navHowTo}>
          <a href="#about" className="tp-about-nav-link">{L.navAbout}</a>
          <a href="#howto" className="tp-about-nav-link">{L.navHowTo}</a>
        </nav>
      </section>

      <section id="about" className="tp-about-section">
        <div className="tp-about-section-head">
          <span className="tp-about-eyebrow">{L.about.kicker}</span>
          <h2 className="tp-about-section-title">{L.about.title}</h2>
          <p className="tp-about-lead">{L.about.lead}</p>
          {L.about.body.map((p) => (
            <p key={p} className="tp-about-body">{p}</p>
          ))}
          <p className="tp-about-body">{t("METHODOLOGY_INDEPENDENCE_BODY")}</p>
        </div>

        <div className="tp-about-pillars">
          {L.about.pillars.map((pillar) => (
            <article key={pillar.title} className="tp-about-pillar">
              <span className="tp-about-pillar-icon">
                <PillarIcon name={pillar.icon} />
              </span>
              <h3 className="tp-about-pillar-title">{pillar.title}</h3>
              <p className="tp-about-pillar-text">{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="howto" className="tp-about-section">
        <div className="tp-about-section-head">
          <span className="tp-about-eyebrow">{L.howto.kicker}</span>
          <h2 className="tp-about-section-title">{L.howto.title}</h2>
        </div>

        <div className="tp-about-fair">
          <span className="tp-about-fair-icon">
            <PillarIcon name="fair" />
          </span>
          <div className="tp-about-fair-text">
            <h3 className="tp-about-fair-title">{L.howto.fairTitle}</h3>
            <p className="tp-about-fair-lead">{L.howto.fairLead}</p>
            {L.howto.fairBody.map((p) => (
              <p key={p} className="tp-about-body">{p}</p>
            ))}
          </div>
        </div>

        <h3 className="tp-about-steps-title">{L.howto.stepsTitle}</h3>
        <ol className="tp-about-steps">
          {L.howto.steps.map((step, i) => (
            <li key={step.title} className="tp-about-step">
              <span className="tp-about-step-num">{i + 1}</span>
              <div>
                <h4 className="tp-about-step-title">{step.title}</h4>
                <p className="tp-about-step-text">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {import.meta.env.VITE_PUBLIC_TRAFFIC_DASHBOARD_URL ? (
        <div className="tp-about-traffic">
          <a
            href={import.meta.env.VITE_PUBLIC_TRAFFIC_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {lang === "ar" ? "لوحة الزيارات والمقاييس (للمستثمرين)" : "Public traffic & metrics (investors)"}
          </a>
        </div>
      ) : null}

      <SiteFooter t={t} />
    </div>
  );
}
