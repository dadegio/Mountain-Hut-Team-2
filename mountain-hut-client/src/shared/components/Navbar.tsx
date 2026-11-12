import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth.ts";

type Role = string | null; // null = guest

const STAFF = ["EMPLOYEE", "MANAGER"];
const MAIL_SERVICE_URL =
  import.meta.env.VITE_MAIL_SERVICE_URL || "http://localhost:8025";

const navItems: { path: string; label: string; end?: boolean; show: (role: Role) => boolean }[] = [
  { path: "/", label: "Home", end: true, show: () => true },
  { path: "/booking", label: "Book a table", show: (role) => role === null || role === "HIKER" },
  { path: "/my-bookings", label: "My bookings", show: (role) => role === "HIKER" },
  { path: "/employee/slots", label: "Manage slots", show: (role) => role !== null && STAFF.includes(role) },
  { path: "/login", label: "Login", show: (role) => role === null },
  { path: "/register", label: "Register", show: (role) => role === null },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "font-semibold text-green-700"
    : "text-stone-700 hover:text-green-700 transition-colors";

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-base transition-colors ${
    isActive
      ? "font-semibold text-green-700 bg-green-50/80"
      : "text-stone-700 hover:text-green-700 hover:bg-white/60"
  }`;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role: Role = user?.type ?? null;
  const isStaff = role !== null && STAFF.includes(role);
  const visibleItems = navItems.filter((item) => item.show(role));

  async function handleLogout() {
    setIsOpen(false);
    await logout();
    navigate("/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-lg backdrop-saturate-150 border-b border-white/50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink to="/" className="text-lg font-bold text-green-800">
          Mountain Hut
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
                  <span aria-hidden="true">✉️</span>
                  <span>Hut Mail</span>
                </a>
              )}
              <span className="text-stone-600">{user.name}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-stone-700 hover:text-green-700 transition-colors cursor-pointer"
              >
                Logout
              </button>
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
        <div className="md:hidden border-t border-white/40 bg-white/80 backdrop-blur-md px-4 pt-2 pb-3 space-y-1 shadow-lg">
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
                  <span aria-hidden="true">✉️</span>
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
