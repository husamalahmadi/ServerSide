// FILE: src/routes/App.jsx
import React, { Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { trackPageView } from "../analytics.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import { I18nProvider, useI18n } from "../i18n.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { RouteFallback } from "../components/RouteFallback.jsx";

import { AppShell } from "../components/AppShell.jsx";
import Home from "./Home.jsx";

const Stock = React.lazy(() => import("./Stock.jsx"));
const Contact = React.lazy(() => import("./Contact.jsx"));
const AboutUs = React.lazy(() => import("./AboutUs.jsx"));
const Methodology = React.lazy(() => import("./Methodology.jsx"));
const Blogs = React.lazy(() => import("./Blogs.jsx"));
const BlogPost = React.lazy(() => import("./BlogPost.jsx"));
const Tutorials = React.lazy(() => import("./Tutorials.jsx"));
const TutorialArticle = React.lazy(() => import("./TutorialArticle.jsx"));
const Profile = React.lazy(() => import("./Profile.jsx"));
const ProfileSetup = React.lazy(() => import("./ProfileSetup.jsx"));
const AuthSignInHelp = React.lazy(() => import("./AuthSignInHelp.jsx"));
const UsMarketPerformance = React.lazy(() => import("./UsMarketPerformance.jsx"));
const SaMarketPerformance = React.lazy(() => import("./SaMarketPerformance.jsx"));
const TasiDataPages = React.lazy(() => import("./TasiDataPages.jsx"));

function StaticSeoFallbackCleanup() {
  useEffect(() => {
    const el = document.getElementById("tp-static-fallback");
    document.documentElement.classList.add("tp-app-ready");
    if (!el) return;
    el.style.transition = "opacity 180ms ease";
    el.style.opacity = "0";
    el.setAttribute("aria-hidden", "true");
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

function LocalePathSync() {
  const { pathname } = useLocation();
  const { setLang } = useI18n();
  useEffect(() => {
    const match = pathname.match(/^\/(en|ar)(?=\/|$)/i);
    if (match) setLang(match[1].toLowerCase());
  }, [pathname, setLang]);
  return null;
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function LegacyTutorialArticleRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/en/tutorials/${encodeURIComponent(slug || "")}`} replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <StaticSeoFallbackCleanup />
            <AnalyticsRouteSync />
            <LocalePathSync />
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
                  path="/en/stock/:ticker"
                  element={
                    <Lazy>
                      <Stock />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/stock/:ticker"
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
                  path="/methodology"
                  element={
                    <Lazy>
                      <Methodology />
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
                  path="/en/blogs"
                  element={
                    <Lazy>
                      <Blogs />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/blogs"
                  element={
                    <Lazy>
                      <Blogs />
                    </Lazy>
                  }
                />
                <Route
                  path="/en/blog/:slug"
                  element={
                    <Lazy>
                      <BlogPost />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/blog/:slug"
                  element={
                    <Lazy>
                      <BlogPost />
                    </Lazy>
                  }
                />
                <Route path="/tutorials" element={<Navigate to="/en/tutorials" replace />} />
                <Route path="/tutorials/:slug" element={<LegacyTutorialArticleRedirect />} />
                <Route
                  path="/en/tutorials"
                  element={
                    <Lazy>
                      <Tutorials />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/tutorials"
                  element={
                    <Lazy>
                      <Tutorials />
                    </Lazy>
                  }
                />
                <Route
                  path="/en/tutorials/:slug"
                  element={
                    <Lazy>
                      <TutorialArticle />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/tutorials/:slug"
                  element={
                    <Lazy>
                      <TutorialArticle />
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
                  path="/ar/tasi/أسهم-أقل-من-قيمتها-العادلة"
                  element={
                    <Lazy>
                      <TasiDataPages />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/tasi/نتائج-الشركات"
                  element={
                    <Lazy>
                      <TasiDataPages />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/tasi/نتائج/:ticker/:period"
                  element={
                    <Lazy>
                      <TasiDataPages />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/sa-markets/:sector"
                  element={
                    <Lazy>
                      <TasiDataPages />
                    </Lazy>
                  }
                />
                <Route
                  path="/ar/compare/:pair"
                  element={
                    <Lazy>
                      <TasiDataPages />
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
