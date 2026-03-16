// FILE: src/routes/App.jsx
import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { I18nProvider } from "../i18n.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { analytics } from "../services/analyticsService.js";

import Home from "./Home.jsx";
import Stock from "./Stock.jsx";
import Contact from "./Contact.jsx";
import AboutUs from "./AboutUs.jsx";
import Blogs from "./Blogs.jsx";

function AnalyticsTracker() {
  const location = useLocation();
  const hasTrackedLanding = useRef(false);

  useEffect(() => {
    if (!hasTrackedLanding.current) {
      hasTrackedLanding.current = true;
      analytics.trackPageHit();
    }
    analytics.trackPageView(location.pathname, { search: location.search });
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AnalyticsTracker />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stock/:ticker" element={<Stock />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/blogs" element={<Blogs />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  );
}
