import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth.ts";
import Icon from "./Icon.tsx";
import Logo from "./Logo.tsx";

type Role = string | null; // null = guest

const STAFF = ["EMPLOYEE", "MANAGER"];
const MAIL_SERVICE_URL =
  import.meta.env.VITE_MAIL_SERVICE_URL ||
  "https://accounts.google.com/AccountChooser?Email=mountain.hut.team2%40gmail.com&continue=https%3A%2F%2Fmail.google.com%2Fmail%2F";

const navItems: { path: string; label: string; end?: boolean; show: (role: Role) => boolean }[] = [
  { path: "/", label: "Home", end: true, show: () => true },
  { path: "/meals", label: "Meals", show: (role) => role === null || role === "HIKER" },
  { path: "/booking", label: "Book a table", show: (role) => role === null || role === "HIKER" },
  { path: "/my-bookings", label: "My bookings", show: (role) => role === "HIKER" },
  { path: "/hikes", label: "Register a hike", show: (role) => role === "HIKER" },
  { path: "/my-hikes", label: "My hikes", show: (role) => role === "HIKER" },
  { path: "/employee/slots", label: "Manage slots", show: (role) => role !== null && STAFF.includes(role) },
  { path: "/employee/menus", label: "Manage menus", show: (role) => role !== null && STAFF.includes(role) },
  { path: "/employee/reservations", label: "New reservation", show: (role) => role !== null && STAFF.includes(role) },
  { path: "/employee/hikes", label: "Registered hikes", show: (role) => role !== null && STAFF.includes(role) },
  { path: "/login", label: "Login", show: (role) => role === null },
  { path: "/register", label: "Register", show: (role) => role === null },
];

// The green bar under the link grows in on hover and stays on the current page
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-green-600 after:transition-transform after:duration-300 ${
    isActive
      ? "font-semibold text-green-700 after:scale-x-100"
      : "text-stone-700 hover:text-green-700 after:scale-x-0 hover:after:scale-x-100"
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-base transition-colors ${
    isActive
      ? "font-semibold text-green-700 bg-green-50/80"
      : "text-stone-700 hover:text-green-700 hover:bg-white/60"
  }`;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role: Role = user?.type ?? null;
  const isStaff = role !== null && STAFF.includes(role);
  const visibleItems = navItems.filter((item) => item.show(role));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  async function handleLogout() {
    setIsOpen(false);
    setIsUserMenuOpen(false);
    await logout();
    navigate("/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-lg backdrop-saturate-150 border-b border-white/50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink to="/" className="group -ml-5 flex translate-y-0.5 items-center">
          <Logo className="h-8" />
        </NavLink>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-6">
          {visibleItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}

          {user && (
            <>
              {isStaff && (
                <a
                  href={MAIL_SERVICE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Hut Email Service"
                  className="inline-flex items-center gap-1.5 text-stone-700 hover:text-green-700 transition-colors"
                >
                  <Icon name="mail" className="w-5 h-5" />
                  <span>Hut Mail</span>
                </a>
              )}
              {/* User dropdown menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-stone-200 bg-white/70 hover:bg-white text-stone-700 hover:text-green-800 transition-all cursor-pointer shadow-xs"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <span className="w-6 h-6 rounded-full bg-green-700 text-white text-xs font-semibold flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-sm">{user.name}</span>
                  <svg
                    className={`w-4 h-4 text-stone-500 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50 animate-pop-in origin-top-right"
                  >
                    <div className="px-4 py-2 border-b border-stone-100">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {user.name} {user.surname}
                      </p>
                      <p className="text-xs text-stone-500 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 capitalize">
                        {user.type.toLowerCase()}
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                          />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-stone-700 hover:text-stone-900 hover:bg-white/60 focus:outline-hidden focus:ring-2 focus:ring-green-700 cursor-pointer"
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile navigation panel */}
      {isOpen && (
        <div className="md:hidden border-t border-white/40 bg-white/80 backdrop-blur-md px-4 pt-2 pb-3 space-y-1 shadow-lg animate-fade-up">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setIsOpen(false)}
              className={mobileLinkClass}
            >
              {item.label}
            </NavLink>
          ))}

          {user && (
            <div className="border-t border-white/50 mt-2 pt-2">
              <p className="px-3 py-1 text-sm text-stone-600">Logged in as {user.name}</p>
              {isStaff && (
                <a
                  href={MAIL_SERVICE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-base text-stone-700 hover:text-green-700 hover:bg-white/60 transition-colors"
                >
                  <Icon name="mail" className="w-5 h-5" />
                  <span>Hut Mail</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 rounded-md text-base text-stone-700 hover:text-green-700 hover:bg-white/60 transition-colors cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
