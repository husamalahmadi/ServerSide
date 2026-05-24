// FILE: src/routes/App.jsx
import React, { Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { trackPageView } from "../analytics.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import { I18nProvider } from "../i18n.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { RouteFallback } from "../components/RouteFallback.jsx";

import { AppShell } from "../components/AppShell.jsx";
import Home from "./Home.jsx";

const Stock = React.lazy(() => import("./Stock.jsx"));
const Contact = React.lazy(() => import("./Contact.jsx"));
const AboutUs = React.lazy(() => import("./AboutUs.jsx"));
const Blogs = React.lazy(() => import("./Blogs.jsx"));
const Profile = React.lazy(() => import("./Profile.jsx"));
const ProfileSetup = React.lazy(() => import("./ProfileSetup.jsx"));
const AuthSignInHelp = React.lazy(() => import("./AuthSignInHelp.jsx"));
const UsMarketPerformance = React.lazy(() => import("./UsMarketPerformance.jsx"));
const SaMarketPerformance = React.lazy(() => import("./SaMarketPerformance.jsx"));

function StaticSeoFallbackCleanup() {
  useEffect(() => {
    document.getElementById("tp-static-fallback")?.remove();
    document.documentElement.classList.add("tp-app-ready");
  }, []);
  return null;
}

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

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <StaticSeoFallbackCleanup />
            <AnalyticsRouteSync />
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route
                  path="/stock/:ticker"
                  element={
                    <Lazy>
                      <Stock />
                    </Lazy>
                  }
                />
                <Route
                  path="/profile/setup"
                  element={
                    <Lazy>
                      <ProfileSetup />
                    </Lazy>
                  }
                />
                <Route
                  path="/profile/:handle"
                  element={
                    <Lazy>
                      <Profile />
                    </Lazy>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Lazy>
                      <Profile />
                    </Lazy>
                  }
                />
                <Route
                  path="/contact"
                  element={
                    <Lazy>
                      <Contact />
                    </Lazy>
                  }
                />
                <Route
                  path="/about"
                  element={
                    <Lazy>
                      <AboutUs />
                    </Lazy>
                  }
                />
                <Route
                  path="/blogs"
                  element={
                    <Lazy>
                      <Blogs />
                    </Lazy>
                  }
                />
                <Route
                  path="/us-markets"
                  element={
                    <Lazy>
                      <UsMarketPerformance />
                    </Lazy>
                  }
                />
                <Route
                  path="/sa-markets"
                  element={
                    <Lazy>
                      <SaMarketPerformance />
                    </Lazy>
                  }
                />
                <Route
                  path="/auth/*"
                  element={
                    <Lazy>
                      <AuthSignInHelp />
                    </Lazy>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  );
}
