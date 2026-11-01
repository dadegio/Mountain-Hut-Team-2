import { NavLink, useLocation } from "react-router";

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { path: "/booking", defaultLabel: "Book a table" },
    { path: "/my-bookings", defaultLabel: "My bookings" },
    { path: "/login", defaultLabel: "Login" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xs border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <NavLink to="/" className="text-lg font-bold text-green-800 mr-auto">
          Mountain Hut
        </NavLink>

        {navItems.map((item) => {
          const isCurrent = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={isCurrent ? "/" : item.path}
              className={isCurrent ? "font-semibold text-green-700" : "text-stone-600 hover:text-green-700"}
              title={isCurrent ? "Back to Home" : undefined}
            >
              {isCurrent ? "Home" : item.defaultLabel}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
