import { useEffect, useState } from "react";
import { Link } from "react-router";
import AuthShell from "../../shared/components/AuthShell.tsx";
import { getMyHikes } from "../api/hikes-api.ts";
import type { Hike } from "../types/hike.ts";
import {
  formatDuration,
  formatHikeRange,
  hikePhase,
  type HikePhase,
} from "../utils/hike-time.ts";

const PHASES: Record<HikePhase, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "bg-green-100 text-green-800" },
  ongoing: { label: "In progress", className: "bg-amber-100 text-amber-800" },
  past: { label: "Past", className: "bg-stone-200 text-stone-600" },
};

type ListedHike = Hike & { phase: HikePhase };

// The hikes of the last load, already split. The phase is worked out when
// they arrive, so that rendering never needs the current time.
interface LoadedHikes {
  upcoming: ListedHike[]; // not finished yet, the soonest first
  past: ListedHike[]; // the most recent first
  error: string | null;
}

function HikeCard({ hike }: { hike: ListedHike }) {
  const durationMs = Date.parse(hike.expectedReturnAt) - Date.parse(hike.departureAt);

  return (
    <li
      className={`rounded-lg border px-4 py-3 ${
        hike.phase === "past" ? "border-stone-200 bg-stone-50/60" : "border-stone-200 bg-white shadow-xs"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            {formatHikeRange(hike.departureAt, hike.expectedReturnAt)}
          </p>
          <p className="text-xs text-stone-500">Out for {formatDuration(durationMs)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASES[hike.phase].className}`}
        >
          {PHASES[hike.phase].label}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{hike.routeDescription}</p>

      {hike.emergencyContactPhone && (
        <p className="mt-2 text-xs text-stone-500">
          Emergency contact: {hike.emergencyContactPhone}
        </p>
      )}
    </li>
  );
}

function SectionHeading({ children, count }: { children: string; count: number }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">
      {children} <span className="text-stone-400">({count})</span>
    </h2>
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
          upcoming: listed.filter((hike) => hike.phase !== "past").reverse(),
          past: listed.filter((hike) => hike.phase === "past"),
          error: null,
        });
      })
      .catch((err) => {
        if (ignore) return;
        setHikes({
          upcoming: [],
          past: [],
          error: err instanceof Error ? err.message : "Could not load your hikes",
        });
      });
    return () => {
      ignore = true;
    };
  }, []);

  const isEmpty = hikes !== null && !hikes.error && hikes.upcoming.length + hikes.past.length === 0;

  return (
    <AuthShell
      width="2xl"
      badge="Safety"
      title="My hikes"
      subtitle="The hikes you have registered with the hut."
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Link
            to="/hikes"
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-500 active:bg-green-700"
          >
            Register a hike
          </Link>
        </div>

        {hikes === null && (
          <div className="space-y-2" aria-label="Loading hikes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-stone-200 animate-pulse" />
            ))}
          </div>
        )}

        {hikes?.error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            Could not load your hikes: {hikes.error}
          </div>
        )}

        {isEmpty && (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            You haven't registered any hikes yet.
          </p>
        )}

        {hikes && hikes.upcoming.length > 0 && (
          <section aria-label="Upcoming hikes">
            <SectionHeading count={hikes.upcoming.length}>Upcoming</SectionHeading>
            <ul className="space-y-2">
              {hikes.upcoming.map((hike) => (
                <HikeCard key={hike.id} hike={hike} />
              ))}
            </ul>
          </section>
        )}

        {hikes && hikes.past.length > 0 && (
          <section aria-label="Past hikes">
            <SectionHeading count={hikes.past.length}>Past</SectionHeading>
            <ul className="space-y-2">
              {hikes.past.map((hike) => (
                <HikeCard key={hike.id} hike={hike} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </AuthShell>
  );
}