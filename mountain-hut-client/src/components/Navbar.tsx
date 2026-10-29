import { NavLink } from "react-router";

const MAIL_SERVICE_URL =
  import.meta.env.VITE_MAIL_SERVICE_URL || "http://localhost:8025";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "font-semibold text-green-700"
    : "text-stone-600 hover:text-green-700";

export default function Navbar() {
  // TODO: when authentication will be implemented, show this button only if user.role === 'EMPLOYEE' || user.role === 'MANAGER'
  const isStaff = true;

  return (
    <nav className="bg-white border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <NavLink to="/" className="text-lg font-bold text-green-800 mr-auto">
          Mountain Hut
        </NavLink>
        <NavLink to="/booking" className={linkClass}>
          Book a table
        </NavLink>
        <NavLink to="/my-bookings" className={linkClass}>
          My bookings
        </NavLink>
        <NavLink to="/login" className={linkClass}>
          Login
        </NavLink>

        {isStaff && (
          <a
            href={MAIL_SERVICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-md transition-colors"
            title="Apri il servizio email del rifugio (Mailpit in locale)"
          >
            <span>⛰️</span>
            <span>Hut Mail</span>
          </a>
        )}
      </div>
    </nav>
  );
}
