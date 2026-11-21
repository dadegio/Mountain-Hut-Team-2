import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth.ts";
import { forgotPassword } from "../../auth/api/auth-api.ts";
import backgroundImage from "../assets/BackgroundMountainHut.jpeg";
import foto1 from "../assets/Foto1MountainHut.jpeg";
import foto2 from "../assets/Foto2MountainHut.jpeg";
import foto3 from "../assets/Foto3MountainHut.jpeg";
import videoHut from "../assets/VideoMountainHut.mp4";

type CarouselSlide = {
  type: "image" | "video";
  src: string;
  icon: string;
  badge: string;
  title?: string;
  description?: string;
  note?: string;
};

const carouselSlides: CarouselSlide[] = [
  {
    type: "image",
    src: foto1,
    icon: "🍽️",
    badge: "Hours & Services",
    title: "Meal Services & Flexible Slots",
    description:
      "We serve hearty lunches (12:00–14:00) and cozy alpine dinners (19:00–21:00). Reservations are accepted online up to 2 hours before the scheduled time slot.",
    note: "* Public availability check requires no login",
  },
  {
    type: "image",
    src: foto2,
    icon: "🪵",
    badge: "Atmosphere",
    title: "Convivial Shared Tables",
    description:
      "In true mountain hut spirit, table sharing is standard practice. Our intelligent seating engine assigns compact table clusters to keep your party seated together.",
    note: "* Modifications allowed up to 48 hours in advance",
  },
  {
    type: "image",
    src: foto3,
    icon: "🛡️",
    badge: "Health & Safety",
    title: "Dietary Needs & Allergy Care",
    description:
      "Safety at high altitude is paramount. Specify allergies and dietary preferences (vegetarian, vegan, celiac) directly in your booking for dedicated kitchen preparation.",
    note: "* Instant confirmation email sent with your full requirements",
  },
  {
    type: "video",
    src: videoHut,
    icon: "🎥",
    badge: "Hut's Life",
  },
];

export default function HomePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.type === "EMPLOYEE" || user?.type === "MANAGER";
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const wasTemporaryRef = useRef(user?.type === "TEMPORARY");

  useEffect(() => {
    if (user?.type === "TEMPORARY") {
      wasTemporaryRef.current = true;
    }
  }, [user?.type]);

  // Poll for account status change while the user is TEMPORARY, or redirect to login when password reset completes
  useEffect(() => {
    if (!wasTemporaryRef.current) return;

    if (!user || user.type !== "TEMPORARY") {
      logout().catch(() => {});
      navigate("/login", {
        state: { message: "Password updated successfully. Please log in with your new password." },
        replace: true,
      });
      return;
    }

    let cancelled = false;

    async function checkStatus() {
      try {
        const u = await refreshUser();
        if (cancelled) return;
        if (!u || u.type !== "TEMPORARY") {
          await logout();
          navigate("/login", {
            state: { message: "Password updated successfully. Please log in with your new password." },
            replace: true,
          });
        }
      } catch {
        // ignore background refresh errors
      }
    }

    const interval = setInterval(checkStatus, 3000);

    const onFocus = () => {
      checkStatus();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "mountain_hut_auth_password_reset" || e.key === "mountain_hut_auth_changed") {
        checkStatus();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [user, refreshUser, logout, navigate]);

  // Auto-scroll every 10 seconds, resets whenever currentSlide changes (manual or automatic), paused on hover or user toggle
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === carouselSlides.length - 1 ? 0 : prev + 1));
    }, 10000);

    return () => clearInterval(timer);
  }, [currentSlide, isPaused]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? carouselSlides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === carouselSlides.length - 1 ? 0 : prev + 1));
  };

  if (user?.type === "TEMPORARY") {
    return (
      <div className="flex flex-col min-h-[calc(100vh-3.5rem)] relative">
        <div
          className="fixed inset-0 top-14 w-full h-[calc(100vh-3.5rem)] pointer-events-none z-0"
          aria-hidden="true"
        >
          <img
            src={backgroundImage}
            alt=""
            className="w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "var(--hero-overlay-color, rgba(0, 0, 0, 0.5))" }}
          />
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20 text-center space-y-6">
            <div>
              <span className="inline-block px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 rounded-full border border-amber-300">
                Temporary Account • Action Required
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-stone-900">
                Welcome, {user.name}!
              </h1>
              <p className="text-sm text-stone-600">
                Please check your email to activate your account.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-900 space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none">✉️</span>
                <div>
                  <p className="font-semibold text-amber-950">Password change required</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    An employee registered your temporary account. We sent a secure link to{" "}
                    <strong>{user.email}</strong>. You must set a permanent password before booking.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-stone-500 py-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span>Waiting for password change… this page will update automatically.</span>
            </div>

            {resendStatus && (
              <div
                role="status"
                className="text-xs rounded-lg p-2.5 bg-green-50 text-green-800 border border-green-200"
              >
                {resendStatus}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={resending}
                onClick={async () => {
                  if (!user.email) return;
                  setResending(true);
                  try {
                    await forgotPassword(user.email);
                    setResendStatus("A new reset link has been sent to your email.");
                  } catch {
                    setResendStatus("Failed to resend email. Please try again shortly.");
                  } finally {
                    setResending(false);
                  }
                }}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-300 transition-colors cursor-pointer"
              >
                {resending ? "Sending…" : "Resend email link"}
              </button>

              <button
                type="button"
                onClick={() => logout()}
                className="w-full text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const slide = carouselSlides[currentSlide];

  return (
    <div className="flex flex-col">
      {/* Fixed Background Image with Parallax Effect */}
      <div
        className="fixed inset-0 top-14 w-full h-[calc(100vh-3.5rem)] pointer-events-none z-0"
        aria-hidden="true"
      >
        <img
          src={backgroundImage}
          alt=""
          className="w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--hero-overlay-color, rgba(0, 0, 0, 0.4))" }}
        />
      </div>

      {/* Hero Content (First Viewport, Transparent over the fixed image) */}
      <section className="relative z-10 w-full min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6 text-white">
          <div>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-200 bg-white/20 backdrop-blur-xs rounded-full border border-white/30 shadow-sm">
              High Altitude Hut • 2,354 m
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight drop-shadow-md">
            Authentic Alpine Flavors at the Summit
          </h1>

          <p className="max-w-2xl mx-auto text-stone-200 text-base sm:text-lg lg:text-xl leading-relaxed drop-shadow-sm">
            Warm traditional meals, fresh local ingredients, and cozy shared
            tables for hikers exploring the alpine trails.
          </p>
    
          {!isStaff && (
            <div className="flex flex-col items-center justify-center gap-4 pt-4">
              <Link
                to="/booking"
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-white/20 hover:bg-white/30 backdrop-blur-xs border border-white/30 rounded-lg shadow-lg transition-colors"
              >
                {user ? "Check Availability & Book Your Table" : "Check Availability"}
              </Link>
              <span className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 text-base font-semibold italic text-white">
                Easier than that it&apos;s impossible{' '}
                <span className="not-italic">😉</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Subsequent Sections (Solid Opaque White Background that slides over the fixed hero) */}
      <div className="relative z-10 w-full bg-white shadow-2xl pt-16 pb-20 px-4 min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-5xl mx-auto space-y-16">
          {/* Interactive Image Carousel Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-green-700">
                  Discover Our Hut
                </span>
                <h2 className="text-2xl font-bold text-stone-900">
                  Experience & Dining Guidelines
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Previous slide"
                  className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-700 transition-colors shadow-xs cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Next slide"
                  className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-700 transition-colors shadow-xs cursor-pointer"
                >
                  ▶
                </button>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-md"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {slide.type === "video" ? (
                /* Full-width Video Card (No description panel) */
                <div className="relative w-full h-[360px] sm:h-[420px] md:h-[480px] overflow-hidden bg-black flex items-center justify-center">
                  <video
                    src={slide.src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 z-20">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white bg-black/60 backdrop-blur-xs rounded-full border border-white/20">
                      <span>{slide.icon}</span>
                      <span>{slide.badge}</span>
                    </span>
                  </div>

                  {/* Slide Indicators on Video */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/10">
                    {carouselSlides.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentSlide(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-2.5 rounded-full transition-all cursor-pointer ${
                          idx === currentSlide
                            ? "w-8 bg-green-500"
                            : "w-2.5 bg-white/40 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* Standard Split Card with Image + Description */
                <div className="grid grid-cols-1 md:grid-cols-2 items-stretch md:min-h-[460px]">
                  {/* Carousel Image container */}
                  <div className="relative min-h-[300px] sm:min-h-[360px] md:min-h-full h-full w-full overflow-hidden bg-stone-900">
                    {carouselSlides.map((item, idx) =>
                      item.type === "image" ? (
                        <img
                          key={idx}
                          src={item.src}
                          alt={item.title || ""}
                          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${
                            idx === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                          }`}
                        />
                      ) : null
                    )}
                    <div className="absolute top-4 left-4 z-20">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white bg-black/50 backdrop-blur-xs rounded-full border border-white/20">
                        <span>{slide.icon}</span>
                        <span>{slide.badge}</span>
                      </span>
                    </div>
                  </div>

                  {/* Information associated with the current slide */}
                  <div className="p-8 md:p-12 flex flex-col justify-center min-h-[360px] md:min-h-[460px] space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 leading-snug min-h-[4rem] sm:min-h-[4.5rem] flex items-center">
                        {slide.title}
                      </h3>
                      <p className="text-base text-stone-600 leading-relaxed min-h-[4.5rem] flex items-center">
                        {slide.description}
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-stone-200">
                      <div className="text-xs font-medium text-stone-500">
                        {slide.note}
                      </div>

                      {/* Slide Indicators */}
                      <div className="flex items-center gap-2">
                        {carouselSlides.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentSlide(idx)}
                            aria-label={`Go to slide ${idx + 1}`}
                            className={`h-2.5 rounded-full transition-all cursor-pointer ${
                              idx === currentSlide
                                ? "w-8 bg-green-700"
                                : "w-2.5 bg-stone-300 hover:bg-stone-400"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* How it works (Step by step for hikers) */}
          <section className="bg-stone-50 rounded-xl border border-stone-200 p-8 shadow-xs">
            <h2 className="text-xl font-bold text-stone-900 mb-8 text-center">
              How to Book Your Mountain Meal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-center">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-green-700 text-white font-bold flex items-center justify-center mx-auto text-sm">
                  1
                </div>
                <div className="font-semibold text-stone-800 text-sm">Select Slot</div>
                <p className="text-xs text-stone-500">
                  Pick your preferred date, lunch or dinner time slot.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-green-700 text-white font-bold flex items-center justify-center mx-auto text-sm">
                  2
                </div>
                <div className="font-semibold text-stone-800 text-sm">Party & Needs</div>
                <p className="text-xs text-stone-500">
                  Indicate group size, dietary preferences, and allergy alerts.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-green-700 text-white font-bold flex items-center justify-center mx-auto text-sm">
                  3
                </div>
                <div className="font-semibold text-stone-800 text-sm">Instant Allocation</div>
                <p className="text-xs text-stone-500">
                  Our system assigns the optimal table arrangement.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-green-700 text-white font-bold flex items-center justify-center mx-auto text-sm">
                  4
                </div>
                <div className="font-semibold text-stone-800 text-sm">Confirmation Email</div>
                <p className="text-xs text-stone-500">
                  Receive your booking reference and summary via email.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
