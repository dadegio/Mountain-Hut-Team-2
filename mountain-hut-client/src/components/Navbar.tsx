import { NavLink } from "react-router";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "font-semibold text-green-700"
    : "text-stone-600 hover:text-green-700";

export default function Navbar() {
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
        </div>
    </nav>
  );
}