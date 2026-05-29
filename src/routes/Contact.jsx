// FILE: client/src/routes/Contact.jsx
import React, { useMemo, useState } from "react";
import { useI18n } from "../i18n.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { getWeb3FormsKey, getWeb3FormsTo } from "../config/env.js";
import { usePageMeta } from "../hooks/usePageMeta.js";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

export default function Contact() {
  const { lang, dir, t } = useI18n();
  const L = useMemo(
    () => ({
      en: {
        title: "Contact Us",
        heroKicker: "We’d love to hear from you",
        heroTitle: "Questions, feedback, or ideas?",
        heroLead:
          "Whether you spotted a data issue, want a new market covered, or simply have a question about fair value—send us a message and we’ll get back to you by email.",
        intro: "Send us a message. We’ll receive it by email.",
        email: "Your Email",
        topic: "Topic",
        message: "Message",
        send: "Send",
        clear: "Clear",
        sent: "Message sent successfully.",
        sending: "Sending…",
        error: "Failed to send. Please try again.",
        emailInvalid: "Enter a valid email address.",
        missingKey: "Missing Web3Forms access key. Add VITE_WEB3FORMS_KEY in client/.env and restart.",
      },
      ar: {
        title: "اتصل بنا",
        heroKicker: "يسعدنا تواصلك معنا",
        heroTitle: "أسئلة، ملاحظات، أو أفكار؟",
        heroLead:
          "سواء لاحظت خطأً في البيانات، أو رغبت بتغطية سوق جديد، أو لديك سؤال عن القيمة العادلة — أرسل لنا رسالتك وسنعاود التواصل معك عبر البريد الإلكتروني.",
        intro: "أرسل رسالتك، وسيصلنا بريد إلكتروني بها.",
        email: "بريدك الإلكتروني",
        topic: "الموضوع",
        message: "نص الرسالة",
        send: "إرسال",
        clear: "مسح",
        sent: "تم إرسال الرسالة بنجاح.",
        sending: "جاري الإرسال…",
        error: "فشل الإرسال. حاول مرة أخرى.",
        emailInvalid: "الرجاء إدخال بريد إلكتروني صالح.",
        missingKey: "مفقود مفتاح Web3Forms. أضِف VITE_WEB3FORMS_KEY في ملف .env ثم أعد التشغيل.",
      },
    }),
    []
  )[lang] || {};
  usePageMeta({
    documentTitle: t("SEO_TITLE_CONTACT"),
    metaDescription: t("SEO_DESC_CONTACT"),
    pathname: "/contact",
  });

  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState({ ok: null, msg: "" });
  const [loading, setLoading] = useState(false);

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  async function handleSend(e) {
    e.preventDefault();
    if (!validEmail(email)) {
      setState({ ok: false, msg: L.emailInvalid });
      return;
    }
    const key = getWeb3FormsKey();
    if (!key) {
      setState({ ok: false, msg: L.missingKey });
      return;
    }

    setLoading(true);
    setState({ ok: null, msg: "" });

    const form = new FormData();
    form.append("access_key", key);
    form.append("from_name", "Stocks App Contact");
    form.append("subject", `[Stocks Contact] ${topic}`.slice(0, 120));
    form.append("email", email);   // sender’s email
    form.append("message", message);

    const to = getWeb3FormsTo();
    if (to) form.append("to", to); // optional override from env

    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!json.success) throw new Error(json.message || `HTTP ${res.status}`);
      setState({ ok: true, msg: L.sent });
      setTopic(""); setMessage("");
    } catch (e) {
      setState({ ok: false, msg: `${L.error} (${e.message})` });
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setEmail(""); setTopic(""); setMessage("");
    setState({ ok: null, msg: "" });
  }

  return (
    <div className="tp-page tp-about-page tp-contact-page" dir={dir} lang={lang}>
      <PageHeader title={L.title} subtitle={t("CONTACT_US")} />

      <section className="tp-about-hero" aria-label={L.heroTitle}>
        <span className="tp-about-hero-glow" aria-hidden />
        <span className="tp-about-hero-kicker">{L.heroKicker}</span>
        <h2 className="tp-about-hero-title">{L.heroTitle}</h2>
        <p className="tp-about-hero-lead">{L.heroLead}</p>
      </section>

      <form onSubmit={handleSend} className="tp-contact-card">
        <p className="tp-contact-intro">{L.intro}</p>

        <label className="tp-contact-field">
          <span className="tp-contact-label">{L.email}</span>
          <input
            className="tp-contact-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="tp-contact-field">
          <span className="tp-contact-label">{L.topic}</span>
          <input
            className="tp-contact-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={L.topic}
            required
            minLength={3}
          />
        </label>

        <label className="tp-contact-field">
          <span className="tp-contact-label">{L.message}</span>
          <textarea
            className="tp-contact-input tp-contact-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={L.message}
            rows={8}
            required
            minLength={5}
          />
        </label>

        <div className="tp-contact-actions">
          <button type="submit" className="tp-contact-send" disabled={loading}>
            {loading ? L.sending : L.send}
          </button>
          <button
            type="button"
            className="tp-contact-clear"
            onClick={handleClear}
            disabled={loading}
          >
            {L.clear}
          </button>
        </div>

        {state.msg && (
          <div className={`tp-contact-status ${state.ok ? "ok" : "err"}`}>
            {state.msg}
          </div>
        )}
      </form>

      <SiteFooter t={t} />
    </div>
  );
}
