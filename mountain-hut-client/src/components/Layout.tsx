import { Outlet } from "react-router";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-800">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="text-center text-sm text-stone-500 py-4">
        Mountain Hut
      </footer>
    </div>
  );
}