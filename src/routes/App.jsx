// FILE: src/routes/App.jsx
import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { trackPageView } from "../analytics.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import { I18nProvider } from "../i18n.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";

import Home from "./Home.jsx";
import Stock from "./Stock.jsx";
import Contact from "./Contact.jsx";
import AboutUs from "./AboutUs.jsx";
import Blogs from "./Blogs.jsx";
import Profile from "./Profile.jsx";
import ProfileSetup from "./ProfileSetup.jsx";
import AuthSignInHelp from "./AuthSignInHelp.jsx";

function AnalyticsRouteSync() {
  const location = useLocation();
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    trackPageView();
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <AnalyticsRouteSync />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/stock/:ticker" element={<Stock />} />
              <Route path="/profile/setup" element={<ProfileSetup />} />
              <Route path="/profile/:handle" element={<Profile />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/auth/*" element={<AuthSignInHelp />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  );
}
