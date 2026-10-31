import { useState, useEffect } from "react";
import { Link } from "react-router";
import backgroundImage from "./images/BackgroundMountainHut.jpeg";
import foto1 from "./images/Foto1MountainHut.jpeg";
import foto2 from "./images/Foto2MountainHut.jpeg";
import foto3 from "./images/Foto3MountainHut.jpeg";

// Placeholder role simulation until authentication is implemented
// Role types matching backend: 'GUEST' | 'HIKER' | 'EMPLOYEE' | 'MANAGER'
type UserRole = "GUEST" | "HIKER" | "EMPLOYEE" | "MANAGER";

const CURRENT_USER_ROLE: UserRole = "GUEST"; // Toggle here to test views: "GUEST", "HIKER", "EMPLOYEE", "MANAGER"

const MAIL_SERVICE_URL =
  import.meta.env.VITE_MAIL_SERVICE_URL || "http://localhost:8025";

const carouselSlides = [
  {
    image: foto1,
    icon: "🍽️",
    badge: "Hours & Services",
    title: "Meal Services & Flexible Slots",
    description:
      "We serve hearty lunches (12:00–14:00) and cozy alpine dinners (19:00–21:00). Reservations are accepted online up to 2 hours before the scheduled time slot.",
    note: "* Public availability check requires no login",
  },
  {
    image: foto2,
    icon: "🪵",
    badge: "Atmosphere",
    title: "Convivial Shared Tables",
    description:
      "In true mountain hut spirit, table sharing is standard practice. Our intelligent seating engine assigns compact table clusters to keep your party seated together.",
    note: "* Modifications allowed up to 48 hours in advance",
  },
  {
    image: foto3,
    icon: "🛡️",
    badge: "Health & Safety",
    title: "Dietary Needs & Allergy Care",
    description:
      "Safety at high altitude is paramount. Specify allergies and dietary preferences (vegetarian, vegan, celiac) directly in your booking for dedicated kitchen preparation.",
    note: "* Instant confirmation email sent with your full requirements",
  },
];

export default function HomePage() {
  const isStaff = CURRENT_USER_ROLE === "EMPLOYEE" || CURRENT_USER_ROLE === "MANAGER";
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-scroll every 10 seconds, resets whenever currentSlide changes (manual or automatic)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === carouselSlides.length - 1 ? 0 : prev + 1));
    }, 10000);

    return () => clearInterval(timer);
  }, [currentSlide]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? carouselSlides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === carouselSlides.length - 1 ? 0 : prev + 1));
  };

  const slide = carouselSlides[currentSlide];

  return (
    <div className="-mx-4 -mt-8 -mb-8 flex flex-col">

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
            <span className="inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-green-300 bg-black/40 backdrop-blur-xs rounded-full border border-green-500/50">
              High Altitude Refuge • 2,350 m
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight drop-shadow-md">
            Authentic Alpine Flavors at the Summit
          </h1>

          <p className="max-w-2xl mx-auto text-stone-200 text-base sm:text-lg lg:text-xl leading-relaxed drop-shadow-sm">
            Warm traditional meals, fresh local ingredients, and cozy shared
            tables for hikers exploring the alpine trails.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/booking"
              className="inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors"
            >
              Book a Table
            </Link>
            <Link
              to="/booking"
              className="inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-white/20 hover:bg-white/30 backdrop-blur-xs border border-white/30 rounded-lg shadow-lg transition-colors"
            >
              Check Availability
            </Link>
          </div>
        </div>
      </section>

      {/* Subsequent Sections (Solid Opaque White Background that slides over the fixed hero) */}
      <div className="relative z-10 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-white shadow-2xl pt-16 pb-20 px-4 min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-5xl mx-auto space-y-16">
          {/* Staff Management Panel (Only visible to EMPLOYEE or MANAGER) */}
          {isStaff && (
            <section className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛠️</span>
                  <h2 className="text-lg font-bold text-amber-900">
                    Staff Quick Portal ({CURRENT_USER_ROLE})
                  </h2>
                </div>
                <a
                  href={MAIL_SERVICE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md shadow-sm transition-colors"
                  title="Open Hut Email Service"
                >
                  <span>✉️</span>
                  <span>Hut Mail Inbox</span>
                </a>
              </div>
              <p className="text-sm text-amber-800">
                Quick operations for dining service and room management:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-sm">
                  <div className="font-semibold text-stone-800 text-sm">MH-02 • Slot Capacity</div>
                  <p className="text-xs text-stone-600 mt-1">
                    Configure table sets and seat capacity for upcoming lunch and dinner slots.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-sm">
                  <div className="font-semibold text-stone-800 text-sm">MH-07 • Walk-in & Phone Booking</div>
                  <p className="text-xs text-stone-600 mt-1">
                    Directly enter reservations on behalf of hikers arriving in person or calling.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-sm">
                  <div className="font-semibold text-stone-800 text-sm">MH-03 • Email Dispatch</div>
                  <p className="text-xs text-stone-600 mt-1">
                    Monitor automatic email confirmations and deliverability status.
                  </p>
                </div>
              </div>
            </section>
          )}

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

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 items-stretch md:min-h-[460px]">
                {/* Carousel Image container */}
                <div className="relative min-h-[300px] sm:min-h-[360px] md:min-h-full h-full w-full overflow-hidden bg-stone-900">
                  {carouselSlides.map((item, idx) => (
                    <img
                      key={idx}
                      src={item.image}
                      alt={item.title}
                      className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${
                        idx === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                      }`}
                    />
                  ))}
                  <div className="absolute top-4 left-4 z-20">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white bg-black/50 backdrop-blur-xs rounded-full border border-white/20">
                      <span>{slide.icon}</span>
                      <span>{slide.badge}</span>
                    </span>
                  </div>
                </div>

                {/* Information associated with the current slide */}
                <div className="p-8 md:p-12 flex flex-col justify-between min-h-[360px] md:min-h-[460px] space-y-6">
                  <div className="space-y-4">
                    <div className="text-3xl">{slide.icon}</div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 leading-snug min-h-[4rem] sm:min-h-[4.5rem] flex items-center">
                      {slide.title}
                    </h3>
                    <p className="text-base text-stone-600 leading-relaxed min-h-[4.5rem]">
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

