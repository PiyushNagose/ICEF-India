// ============================
// FILE: PublicLayout.jsx
// ============================

import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, Mail, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardPath, useAuth } from "../../hooks/useAuth";
import logo from "../../assets/logo.png";

const PublicLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMainHovering, setIsMainHovering] = useState(false);
  const [hasScrollablePage, setHasScrollablePage] = useState(false);
  const [scrollThumb, setScrollThumb] = useState({ height: 0, top: 0 });
  const { user, token } = useAuth();
  const isLoggedIn = !!(user && token);
  const dashboardPath = getDashboardPath(user);

  const location = useLocation();

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
      label: "Home",
      path: "/",
    },

    {
      label: "About Us",
      path: "/about",
    },

    {
      label: "How to Apply",
      path: "/how-to-apply",
    },

    {
      label: "FAQ",
      path: "/faq",
    },

    {
      label: "Contact Us",
      path: "/contact",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f3efe8] overflow-x-hidden flex flex-col">
      {/* MAIN HEADER */}

      <header className="sticky top-0 z-50 bg-[#f6f1ea]/95 backdrop-blur-md border-b border-[#ddd4ca]">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[72px] flex items-center justify-between">
            {/* LOGO */}

            <Link to="/" className="flex items-center gap-3">
              <div className="h-12 px-5 rounded-[6px] bg-[#1f1d1b] flex items-center justify-center">
                <img
                  src={logo}
                  alt="Recruitment Portal"
                  className="h-9 w-auto object-contain"
                />
              </div>
            </Link>

            {/* DESKTOP NAV */}

            <nav className="hidden lg:flex items-center gap-8">
              {navItems.map((item) => {
                const active = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative text-[12px] uppercase tracking-[0.14em] font-black transition-all ${
                      active
                        ? "text-[#e46a1d]"
                        : "text-[#5f5752] hover:text-[#e46a1d]"
                    }`}
                  >
                    {item.label}

                    {active && (
                      <div className="absolute left-0 right-0 -bottom-[28px] h-[3px] bg-[#e46a1d]" />
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
                    to="/auth/register"
                    className="hidden sm:flex h-[42px] px-6 bg-white border-2 border-[#e46a1d] text-[#e46a1d] hover:bg-[#e46a1d] hover:text-white rounded-[4px] items-center justify-center text-[11px] uppercase tracking-[0.12em] font-black transition-all"
                  >
                    Register
                  </Link>
                  <Link
                    to="/auth/candidate-login"
                    className="hidden sm:flex h-[42px] px-6 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] items-center justify-center text-[11px] uppercase tracking-[0.12em] font-black transition-all shadow-lg shadow-orange-200"
                  >
                    Login
                  </Link>
                </>
              )}
              {isLoggedIn && (
                <Link
                  to={dashboardPath}
                  className="hidden sm:flex h-[42px] px-6 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] items-center justify-center text-[11px] uppercase tracking-[0.12em] font-black transition-all shadow-lg shadow-orange-200"
                >
                  Dashboard
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
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-[4px] text-[12px] uppercase tracking-[0.12em] font-black text-[#3f3a36] hover:bg-[#ece5dc]"
                >
                  {item.label}
                </Link>
              ))}

              {!isLoggedIn && (
                <>
                  <Link
                    to="/auth/register"
                    className="mt-4 flex h-[46px] bg-white border-2 border-[#e46a1d] text-[#e46a1d] rounded-[4px] items-center justify-center text-[12px] uppercase tracking-[0.12em] font-black"
                  >
                    Register
                  </Link>
                  <Link
                    to="/auth/candidate-login"
                    className="mt-2 flex h-[46px] bg-[#e46a1d] text-white rounded-[4px] items-center justify-center text-[12px] uppercase tracking-[0.12em] font-black"
                  >
                    Login
                  </Link>
                </>
              )}
              {isLoggedIn && (
                <Link
                  to={dashboardPath}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-4 flex h-[46px] bg-[#e46a1d] text-white rounded-[4px] items-center justify-center text-[12px] uppercase tracking-[0.12em] font-black"
                >
                  Dashboard
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

      <footer className="bg-[#1b1b1b] text-white mt-12">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {/* BRAND */}

            <div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-[6px] bg-[#1f1d1b] flex items-center justify-center overflow-hidden">
                  <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1.5" />
                </div>

                <div>
                  <h3 className="text-[18px] font-black">Recruitment Portal</h3>

                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/50 mt-1">
                    Government of India
                  </p>
                </div>
              </div>

              <p className="mt-6 text-white/65 text-[14px] leading-7">
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
                  ["Latest Jobs", "/jobs"],
                  ["Results", "/results"],
                  ["Admit Cards", "/admit-cards"],
                  ["Notifications", "/notices"],
                ].map(([item, path]) => (
                  <Link
                    key={item}
                    to={path}
                    className="block text-white/65 hover:text-orange-300 transition-colors text-[14px]"
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
                  ["FAQ", "/faq"],
                  ["Help Center", "/help-center"],
                  ["Technical Support", "/technical-support"],
                  ["Contact Us", "/contact"],
                ].map(([item, path]) => (
                  <Link
                    key={item}
                    to={path}
                    className="block text-white/65 hover:text-orange-300 transition-colors text-[14px]"
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
                <div className="flex items-start gap-3 text-white/70">
                  <Phone className="w-5 h-5 mt-0.5 text-orange-400" />

                  <span className="text-[14px]">1800-123-4567</span>
                </div>

                <div className="flex items-start gap-3 text-white/70">
                  <Mail className="w-5 h-5 mt-0.5 text-orange-400" />

                  <span className="text-[14px]">
                    support@recruitment.gov.in
                  </span>
                </div>

                <div className="flex items-start gap-3 text-white/70">
                  <MapPin className="w-5 h-5 mt-0.5 text-orange-400" />

                  <span className="text-[14px]">New Delhi, India</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM */}

          <div className="mt-14 pt-8 border-t border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <p className="text-white/50 text-[13px]">
              Â© 2026 Bihar State Recruitment Board. All Rights Reserved.
            </p>

            <div className="flex items-center gap-6 text-white/40 text-[12px]">
              <Link
                to="/about"
                className="hover:text-orange-300 transition-colors"
              >
                Privacy Policy
              </Link>

              <Link
                to="/about"
                className="hover:text-orange-300 transition-colors"
              >
                Terms & Conditions
              </Link>

              <Link
                to="/about"
                className="hover:text-orange-300 transition-colors"
              >
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;

