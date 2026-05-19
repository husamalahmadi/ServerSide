/**
 * Reports Core Web Vitals to GA4 (when gtag is available).
 * Helps monitor speed in Analytics while Google CrUX field data accumulates.
 */
export function initWebVitalsReporting() {
  if (typeof window === "undefined") return;

  import("web-vitals")
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const send = (metric) => {
        if (typeof window.gtag !== "function") return;
        const value =
          metric.name === "CLS" ? Math.round(metric.value * 1000) : Math.round(metric.value);
        window.gtag("event", metric.name, {
          value,
          metric_id: metric.id,
          metric_value: metric.value,
          metric_delta: metric.delta,
          event_category: "Web Vitals",
          non_interaction: true,
        });
      };
      onCLS(send);
      onINP(send);
      onLCP(send);
      onFCP(send);
      onTTFB(send);
    })
    .catch(() => {
      /* optional dependency — ignore if load fails */
    });
}
