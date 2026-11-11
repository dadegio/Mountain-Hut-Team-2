import type { ReactNode } from "react";
import backgroundImage from "../../assets/BackgroundMountainHut.jpeg";

const widths = {
  md: "max-w-md", // login
  "2xl": "max-w-2xl", // register
  "4xl": "max-w-4xl", // booking
} as const;

interface AuthShellProps {
  badge: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof widths;
}

export default function AuthShell({ badge, title, subtitle, children, footer, width = "md" }: AuthShellProps) {
  return (
    // Fills the screen, navbar included, so the photo shows through the frosted navbar.
    // Only scrolls on its own when the content is taller than the screen.
    <div className="fixed inset-0 z-10 overflow-y-auto pt-14">
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <img
          src={backgroundImage}
          alt=""
          className="w-full h-full object-cover object-center blur-sm scale-105"
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--hero-overlay-color, rgba(0, 0, 0, 0.4))" }}
        />
      </div>

      <section className="relative min-h-full flex items-center justify-center px-4 pt-6 pb-20">
        <div className={`w-full ${widths[width]}`}>
          <div className="text-center text-white mb-4 space-y-2">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-200 bg-white/20 backdrop-blur-xs rounded-full border border-white/30 shadow-sm">
              {badge}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-md">
              {title}
            </h1>
            <p className="text-sm text-stone-200 drop-shadow-sm">{subtitle}</p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/40 p-5 sm:p-7">
            {children}
          </div>

          {footer && <div className="mt-4 text-center text-sm text-stone-200">{footer}</div>}
        </div>
      </section>
    </div>
  );
}