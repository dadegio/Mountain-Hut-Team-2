import { useEffect, useState } from "react";
import { Link } from "react-router";
import AuthShell from "../../shared/components/AuthShell.tsx";
import Icon, { type IconName } from "../../shared/components/Icon.tsx";
import { getMyHikes } from "../api/hikes-api.ts";
import type { Hike } from "../types/hike.ts";
import {
  formatDuration,
  formatHikeRange,
  formatHikeTime,
  hikePhase,
  type HikePhase,
} from "../utils/hike-time.ts";

const PHASES: Record<HikePhase, { label: string; className: string; icon: IconName; accent: string }> = {
  upcoming: { label: "Upcoming", className: "bg-green-100 text-green-800", icon: "calendar", accent: "before:bg-green-500" },
  ongoing: { label: "In progress", className: "bg-amber-100 text-amber-800", icon: "map", accent: "before:bg-amber-400" },
  past: { label: "Past", className: "bg-stone-200 text-stone-600", icon: "check", accent: "before:bg-stone-300" },
};

const detail = "flex items-start gap-2 text-sm";

type ListedHike = Hike & { phase: HikePhase };

// The hikes of the last load, already split. The phase is worked out when
// they arrive, so that rendering never needs the current time.
interface LoadedHikes {
  ongoing: ListedHike[]; // the earliest return first
  upcoming: ListedHike[]; // the soonest departure first
  past: ListedHike[]; // the most recent first
  error: string | null;
}

function HikeCard({ hike, index }: { hike: ListedHike; index: number }) {
  const durationMs = Date.parse(hike.expectedReturnAt) - Date.parse(hike.departureAt);

  const cardClass = {
    ongoing: "border-amber-300 bg-amber-50/60 shadow-xs",
    upcoming: "border-stone-200 bg-white shadow-xs",
    past: "border-stone-200 bg-stone-50/60",
  }[hike.phase];

  return (
    <li
      style={{ animationDelay: `${index * 60}ms` }}
      className={`relative overflow-hidden rounded-2xl border p-5 pl-6 transition-shadow hover:shadow-md animate-fade-up before:absolute before:inset-y-0 before:left-0 before:w-1.5 ${PHASES[hike.phase].accent} ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <span
            className={`flex items-center justify-center w-11 h-11 shrink-0 rounded-xl ${
              hike.phase === "ongoing" ? "bg-amber-100 text-amber-700" : "bg-green-50 text-green-700"
            }`}
          >
            <Icon name="pin" className="w-6 h-6" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-lg font-semibold text-stone-900">{hike.destination}</p>
            <p className="flex items-center gap-2 text-base text-stone-700">
              <Icon name="calendar" className="w-4 h-4 text-stone-400" />
              {formatHikeRange(hike.departureAt, hike.expectedReturnAt)}
            </p>
            <p className="flex items-center gap-2 text-sm text-stone-500">
              <Icon name="clock" className="w-4 h-4 text-stone-400" />
              Out for {formatDuration(durationMs)}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${PHASES[hike.phase].className}`}
        >
          {hike.phase === "ongoing" ? (
            <span className="relative flex w-2.5 h-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-500" />
            </span>
          ) : (
            <Icon name={PHASES[hike.phase].icon} className="w-4 h-4" />
          )}
          {PHASES[hike.phase].label}
        </span>
      </div>

      <div className="mt-3 space-y-2 border-t border-stone-200/70 pt-3 sm:ml-15">
        {hike.phase === "ongoing" && (
          <p className="flex items-center gap-2 text-base font-semibold text-amber-800">
            <Icon name="clock" className="w-5 h-5" />
            Expected back {formatHikeTime(hike.expectedReturnAt)}
          </p>
        )}

        {hike.intermediatePoints.length > 0 && (
          <p className={`${detail} text-stone-700`}>
            <Icon name="map" className="w-4 h-4 mt-0.5 text-stone-400" />
            Via {hike.intermediatePoints.join(" → ")}
          </p>
        )}

        <p className="whitespace-pre-line text-sm text-stone-600">{hike.routeDescription}</p>

        {hike.emergencyContactPhone && (
          <p className={`${detail} text-stone-500`}>
            <Icon name="phone" className="w-4 h-4 mt-0.5 text-stone-400" />
            Emergency contact: {hike.emergencyContactPhone}
          </p>
        )}

        {hike.phase === "ongoing" && (
          <div className="pt-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 active:bg-violet-700 transition-colors cursor-pointer shadow-xs"
              onClick={() => {
                // TODO: for Alice, insert here the onClick action that updates the status of an hike
                // I was thinking that an hike should not go inside the "Past" box before the hiker
                // presses on the "Hike Completed" button. There is some rework of the logic that has to
                // be done but if i don't have the backend i can't do it
                alert(`Hike #${hike.id} marked as completed! (Test mock)`);
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Hike completed
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// Approximate height of ~3 cards (each ~180px) + gaps
const CARD_APPROX_HEIGHT = 196; // px per card
const MAX_VISIBLE = 2;

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function HikeSection({ title, label, icon, hikes }: { title: string; label: string; icon: IconName; hikes: ListedHike[] }) {
  const [open, setOpen] = useState(false);
  if (hikes.length === 0) return null;

  const maxHeight = MAX_VISIBLE * CARD_APPROX_HEIGHT + (MAX_VISIBLE - 1) * 16; // 16px = gap-4

  return (
    <section aria-label={label}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold uppercase tracking-wider text-green-700 hover:text-green-600 transition-colors"
        aria-expanded={open}
      >
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        <span className="text-stone-400">({hikes.length})</span>
        <Icon name={icon} className="w-5 h-5" />
        {title}
      </button>

      {open && (
        <ul
          className="space-y-4 overflow-y-auto pr-1"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {hikes.map((hike, index) => (
            <HikeCard key={hike.id} hike={hike} index={index} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MyHikesPage() {
  const [hikes, setHikes] = useState<LoadedHikes | null>(null);

  useEffect(() => {
    let ignore = false;
    getMyHikes()
      .then((list) => {
        if (ignore) return;
        const now = Date.now();
        // The API returns the latest departure first
        const listed = list.map((hike) => ({ ...hike, phase: hikePhase(hike, now) }));
        setHikes({
          ongoing: listed
            .filter((hike) => hike.phase === "ongoing")
            .sort((a, b) => Date.parse(a.expectedReturnAt) - Date.parse(b.expectedReturnAt)),
          upcoming: listed.filter((hike) => hike.phase === "upcoming").reverse(),
          past: listed.filter((hike) => hike.phase === "past"),
          error: null,
        });
      })
      .catch((err) => {
        if (ignore) return;
        setHikes({
          ongoing: [],
          upcoming: [],
          past: [],
          error: err instanceof Error ? err.message : "Could not load your hikes",
        });
      });
    return () => {
      ignore = true;
    };
  }, []);

  const isEmpty =
    hikes !== null &&
    !hikes.error &&
    hikes.ongoing.length + hikes.upcoming.length + hikes.past.length === 0;

  return (
    <AuthShell
      width="4xl"
      badge="Safety"
      title="My hikes"
      subtitle="The hikes you have registered with the hut."
    >
      <div className="space-y-8">
        <div className="flex justify-end">
          <Link
            to="/hikes"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-base font-semibold text-white shadow-md transition-all hover:bg-green-500 hover:shadow-lg active:bg-green-700"
          >
            <Icon name="plus" className="w-5 h-5" />
            Register a hike
          </Link>
        </div>

        {hikes === null && (
          <div className="space-y-4" aria-label="Loading hikes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-stone-200 animate-pulse" />
            ))}
          </div>
        )}

        {hikes?.error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            <Icon name="warning" className="w-5 h-5" />
            Could not load your hikes: {hikes.error}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-10 text-center">
            <span className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-700 animate-pop-in">
              <Icon name="map" className="w-8 h-8" />
            </span>
            <p className="text-lg text-stone-600">You haven't registered any hikes yet.</p>
          </div>
        )}

        {hikes && !hikes.error && (
          <>
            <HikeSection title="Upcoming" label="Upcoming hikes" icon="calendar" hikes={hikes.upcoming} />
            <HikeSection title="In progress" label="Hikes in progress" icon="map" hikes={hikes.ongoing} />
            <HikeSection title="Past" label="Past hikes" icon="clock" hikes={hikes.past} />
          </>
        )}
      </div>
    </AuthShell>
  );
}