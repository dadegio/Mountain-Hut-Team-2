import { Outlet, useLocation } from "react-router";
import Navbar from "./Navbar";

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-800 pt-14 overflow-x-clip">
      <Navbar />

      <main className={`flex-1 w-full ${isHome ? "" : "max-w-5xl mx-auto px-4 py-8"}`}>
        <Outlet />
      </main>

    <footer className="relative z-20 text-center text-sm text-stone-600 py-4 bg-white/85 backdrop-blur-lg backdrop-saturate-150 border-t border-white/50">        Mountain Hut
      </footer>
    </div>
  );
}
