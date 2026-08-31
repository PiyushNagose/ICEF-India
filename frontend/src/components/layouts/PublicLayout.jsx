// ============================
// FILE: PublicLayout.jsx
// ============================

import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Menu, X, Phone, Mail, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardPath, isCandidateUser, useAuth } from "../../hooks/useAuth";
import logo from "../../assets/logo.png";

const PublicLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMainHovering, setIsMainHovering] = useState(false);
  const [hasScrollablePage, setHasScrollablePage] = useState(false);
  const [scrollThumb, setScrollThumb] = useState({ height: 0, top: 0 });
  const { user, token } = useAuth();
  const isLoggedIn = !!(user && token);
  const dashboardPath = isCandidateUser(user) ? "/check-status" : getDashboardPath(user);
  const dashboardLabel = isCandidateUser(user) ? "Check Status" : "Dashboard";

  const location = useLocation();
  const projectMatch = location.pathname.match(/^\/apply\/([^/]+)/);
  const currentProjectSlug = projectMatch?.[1] || "";
  const storedProjectSlug =
    typeof window === "undefined"
      ? ""
      : window.sessionStorage.getItem("lastPublicProjectSlug") || "";
  const projectSlug = currentProjectSlug || storedProjectSlug;
  const projectHomePath = projectSlug ? `/apply/${projectSlug}` : "/";
  const isProjectScopedPage = Boolean(projectMatch);

  useEffect(() => {
    if (!currentProjectSlug) return;
    window.sessionStorage.setItem("lastPublicProjectSlug", currentProjectSlug);
  }, [currentProjectSlug]);

  useEffect(() => {
    document.documentElement.classList.add("public-scroll-page");
    document.body.classList.add("public-scroll-page");

    return () => {
      document.documentElement.classList.remove("public-scroll-page", "public-main-hover");
      document.body.classList.remove("public-scroll-page", "public-main-hover");
    };
  }, []);

  useEffect(() => {
    const updateScrollThumb = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);
      const trackHeight = Math.max(window.innerHeight - 16, 0);
      setHasScrollablePage(maxScroll > 0);
      const thumbHeight =
        maxScroll === 0
          ? trackHeight
          : Math.max((window.innerHeight / doc.scrollHeight) * trackHeight, 48);
      const top =
        maxScroll === 0
          ? 8
          : 8 + (window.scrollY / maxScroll) * (trackHeight - thumbHeight);

      setScrollThumb({ height: thumbHeight, top });
    };

    updateScrollThumb();
    window.addEventListener("scroll", updateScrollThumb, { passive: true });
    window.addEventListener("resize", updateScrollThumb);

    return () => {
      window.removeEventListener("scroll", updateScrollThumb);
      window.removeEventListener("resize", updateScrollThumb);
    };
  }, []);

  const setMainHover = (isHovering) => {
    setIsMainHovering(isHovering);
    document.documentElement.classList.toggle("public-main-hover", isHovering);
    document.body.classList.toggle("public-main-hover", isHovering);
  };

  const navItems = [
    {
      label: "How to Apply",
      path: "/how-to-apply",
    },

    {
      label: "Admit Card",
      path: "/admit-cards",
    },

    {
      label: "Check Status",
      path: "/check-status",
    },

    {
      label: "Support",
      path: "/contact",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f3efe8] overflow-x-hidden flex flex-col">
      {/* MAIN HEADER */}

      <header className="sticky top-0 z-50 bg-[#f6f1ea]/95 backdrop-blur-md border-b border-[#ddd4ca]">
        {!isProjectScopedPage && projectSlug && (
          <div className="border-b border-[#e7dcd1] bg-white/60">
            <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
              <Link
                to={projectHomePath}
                className="inline-flex h-9 items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#e46a1d] transition-colors hover:text-[#b94711]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Recruitment
              </Link>
            </div>
          </div>
        )}
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[72px] flex items-center justify-between">
            {/* LOGO */}

            <Link to={projectHomePath} className="flex items-center gap-3">
              <div className="h-12 px-5 rounded-[6px] bg-[#1f1d1b] flex items-center justify-center">
                <img
                  src={logo}
                  alt="Recruitment Portal"
                  className="h-9 w-auto object-contain"
                />
              </div>
            </Link>

            {/* DESKTOP NAV */}

            <nav className="hidden lg:flex h-full items-center gap-10 xl:gap-12 2xl:gap-14">
              {navItems.map((item) => {
                const active = location.pathname === item.path;

                return (
                  <Link
                    key={`${item.label}-${item.path}`}
                    to={item.path}
                    className={`relative flex h-full items-center text-[12px] uppercase tracking-[0.14em] font-black transition-all ${
                      active
                        ? "text-[#e46a1d]"
                        : "text-[#5f5752] hover:text-[#e46a1d]"
                    }`}
                  >
                    {item.label}

                    {active && (
                      <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-[#e46a1d]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* RIGHT */}

            <div className="flex items-center gap-3">
              {!isLoggedIn && (
                <>
                  <Link
                    to="/check-status"
                    className="hidden sm:flex h-[42px] px-6 bg-white border-2 border-[#e46a1d] text-[#e46a1d] hover:bg-[#e46a1d] hover:text-white rounded-[4px] items-center justify-center text-[11px] uppercase tracking-[0.12em] font-black transition-all"
                  >
                    Check Status
                  </Link>
                  <Link
                    to="/admit-cards"
                    className="hidden sm:flex h-[42px] px-6 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] items-center justify-center text-[11px] uppercase tracking-[0.12em] font-black transition-all shadow-lg shadow-orange-200"
                  >
                    Admit Card
                  </Link>
                </>
              )}
              {isLoggedIn && (
                <Link
                  to={dashboardPath}
                  className="hidden sm:flex h-[42px] px-6 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] items-center justify-center text-[11px] uppercase tracking-[0.12em] font-black transition-all shadow-lg shadow-orange-200"
                >
                  {dashboardLabel}
                </Link>
              )}

              {/* MOBILE */}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden w-11 h-11 rounded-[4px] border border-[#ddd4ca] flex items-center justify-center text-[#1f1d1b]"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE NAV */}

        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-[#ddd4ca] bg-[#f6f1ea]">
            <div className="px-4 py-5 space-y-1">
              {navItems.map((item) => {
                const active = location.pathname === item.path;

                return (
                  <Link
                    key={`${item.label}-${item.path}`}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block rounded-[4px] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? "bg-orange-50 text-[#e46a1d]"
                        : "text-[#3f3a36] hover:bg-[#ece5dc]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {!isLoggedIn && (
                <>
                  <Link
                    to="/check-status"
                    className="mt-4 flex h-[46px] bg-white border-2 border-[#e46a1d] text-[#e46a1d] rounded-[4px] items-center justify-center text-[12px] uppercase tracking-[0.12em] font-black"
                  >
                    Check Status
                  </Link>
                  <Link
                    to="/admit-cards"
                    className="mt-2 flex h-[46px] bg-[#e46a1d] text-white rounded-[4px] items-center justify-center text-[12px] uppercase tracking-[0.12em] font-black"
                  >
                    Admit Card
                  </Link>
                </>
              )}
              {isLoggedIn && (
                <Link
                  to={dashboardPath}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-4 flex h-[46px] bg-[#e46a1d] text-white rounded-[4px] items-center justify-center text-[12px] uppercase tracking-[0.12em] font-black"
                >
                  {dashboardLabel}
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* MAIN */}

      <main
        className="public-content-root flex-1"
        onMouseEnter={() => setMainHover(true)}
        onMouseLeave={() => setMainHover(false)}
        onFocus={() => setMainHover(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setMainHover(false);
          }
        }}
      >
        {children}
      </main>

      <div
        aria-hidden="true"
        className={`fixed right-1 top-0 z-[80] w-2 pointer-events-none transition-opacity duration-200 ${
          isMainHovering && hasScrollablePage
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        <div
          className="absolute right-0 w-1.5 rounded-full bg-white/45 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] backdrop-blur-sm"
          style={{
            height: `${scrollThumb.height}px`,
            transform: `translateY(${scrollThumb.top}px)`,
          }}
        />
      </div>

      {/* FOOTER */}

      <footer className="mt-12 bg-[#1b1b1b] text-white">
        <div className="mx-auto max-w-[1380px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr] lg:gap-12">
            {/* BRAND */}

            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-[150px] shrink-0 items-center justify-center rounded-[6px] bg-[#1f1d1b]">
                  <img
                    src={logo}
                    alt="ICEF India"
                    className="h-9 w-auto object-contain"
                  />
                </div>

                <div>
                  <h3 className="text-[18px] font-black">Recruitment Portal</h3>

                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/50">
                    Government of India
                  </p>
                </div>
              </div>

              <p className="mt-6 max-w-[360px] text-[14px] leading-7 text-white/65">
                Official government recruitment platform for transparent,
                accessible, and trusted hiring.
              </p>
            </div>

            {/* QUICK LINKS */}

            <div>
              <h3 className="text-[13px] uppercase tracking-[0.14em] font-black text-white">
                Quick Links
              </h3>

              <div className="mt-6 space-y-4">
                {[
                  ["Results", "/results"],
                  ["Admit Cards", "/admit-cards"],
                  ["Check Status", "/check-status"],
                ].map(([item, path]) => (
                  <Link
                    key={item}
                    to={path}
                    className="block text-[14px] text-white/65 transition-colors hover:text-orange-300"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            {/* SUPPORT */}

            <div>
              <h3 className="text-[13px] uppercase tracking-[0.14em] font-black text-white">
                Support
              </h3>

              <div className="mt-6 space-y-4">
                {[
                  ["How to Apply", "/how-to-apply"],
                  ["Request Correction", "/correction-request"],
                  ["Contact Us", "/contact"],
                ].map(([item, path]) => (
                  <Link
                    key={item}
                    to={path}
                    className="block text-[14px] text-white/65 transition-colors hover:text-orange-300"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            {/* CONTACT */}

            <div>
              <h3 className="text-[13px] uppercase tracking-[0.14em] font-black text-white">
                Contact Info
              </h3>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 text-white/70">
                  <Phone className="mt-0.5 h-5 w-5 text-orange-400" />

                  <span className="text-[14px]">1800-123-4567</span>
                </div>

                <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 text-white/70">
                  <Mail className="mt-0.5 h-5 w-5 text-orange-400" />

                  <span className="text-[14px]">
                    support@recruitment.gov.in
                  </span>
                </div>

                <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 text-white/70">
                  <MapPin className="mt-0.5 h-5 w-5 text-orange-400" />

                  <span className="text-[14px]">New Delhi, India</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM */}

          <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-8 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-[13px] text-white/50">
              © 2026 Recruitment Portal. All Rights Reserved.
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-white/40">
              <Link to={projectHomePath} className="hover:text-orange-300 transition-colors">
                Current Recruitment
              </Link>
              <Link to="/contact" className="hover:text-orange-300 transition-colors">
                Support
              </Link>
              <Link to="/check-status" className="hover:text-orange-300 transition-colors">
                Status
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;

