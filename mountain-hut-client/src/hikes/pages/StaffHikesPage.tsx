import { useEffect, useState } from "react";
import AuthShell from "../../shared/components/AuthShell.tsx";
import { getRegisteredHikes } from "../api/hikes-api.ts";
import type { StaffHike } from "../types/hike.ts";
import {
  formatDuration,
  formatHikeRange,
  formatHikeTime,
  staffHikeGroup,
  type StaffHikeGroup,
} from "../utils/hike-time.ts";

type ListedStaffHike = StaffHike & { group: StaffHikeGroup; lateMs: number };

// The hikes of the last load, already grouped. Groups and delays are worked
// out when the data arrives, so that rendering never needs the current time.
interface LoadedStaffHikes {
  groups: Record<StaffHikeGroup, ListedStaffHike[]>;
  updatedAt: string;
  error: string | null;
}

interface Section {
  group: StaffHikeGroup;
  title: string;
  badge: string;
  badgeClass: string;
  cardClass: string;
}

// Most urgent first
const SECTIONS: Section[] = [
  {
    group: "overdue",
    title: "Should be back",
    badge: "Overdue",
    badgeClass: "bg-red-100 text-red-800",
    cardClass: "border-red-300 bg-red-50/70",
  },
  {
    group: "out",
    title: "Out now",
    badge: "Out now",
    badgeClass: "bg-amber-100 text-amber-800",
    cardClass: "border-amber-200 bg-white shadow-xs",
  },
  {
    group: "upcoming",
    title: "Upcoming",
    badge: "Upcoming",
    badgeClass: "bg-green-100 text-green-800",
    cardClass: "border-stone-200 bg-white shadow-xs",
  },
  {
    group: "earlier",
    title: "Earlier",
    badge: "Past",
    badgeClass: "bg-stone-200 text-stone-600",
    cardClass: "border-stone-200 bg-stone-50/60",
  },
];

function emptyGroups(): Record<StaffHikeGroup, ListedStaffHike[]> {
  return { overdue: [], out: [], upcoming: [], earlier: [] };
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function StaffHikeCard({ hike, section }: { hike: ListedStaffHike; section: Section }) {
  const durationMs = Date.parse(hike.expectedReturnAt) - Date.parse(hike.departureAt);

  return (
    <li className={`rounded-lg border px-4 py-3 ${section.cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            {hike.hiker.name} {hike.hiker.surname}
          </p>
          <p className="text-sm text-stone-600">
            {formatHikeRange(hike.departureAt, hike.expectedReturnAt)} · out for{" "}
            {formatDuration(durationMs)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${section.badgeClass}`}
        >
          {section.badge}
        </span>
      </div>

      {hike.group === "overdue" && (
        <p className="mt-2 text-sm font-semibold text-red-700">
          Expected back {formatHikeTime(hike.expectedReturnAt)} · {formatDuration(hike.lateMs)} late
        </p>
      )}

      <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{hike.routeDescription}</p>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {hike.hiker.phoneNumber ? (
          <a
            href={telHref(hike.hiker.phoneNumber)}
            className="font-medium text-green-700 hover:underline"
          >
            Hiker: {hike.hiker.phoneNumber}
          </a>
        ) : (
          <span className="text-stone-400">No hiker phone</span>
        )}
        {hike.emergencyContactPhone && (
          <a
            href={telHref(hike.emergencyContactPhone)}
            className="font-medium text-green-700 hover:underline"
          >
            Emergency contact: {hike.emergencyContactPhone}
          </a>
        )}
      </div>
    </li>
  );
}

export default function RegisteredHikesPage() {
  const [hikes, setHikes] = useState<LoadedStaffHikes | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    getRegisteredHikes()
      .then((list) => {
        if (ignore) return;
        const now = Date.now();
        const groups = emptyGroups();
        // The API sorts by expected return: right for every group but "earlier"
        for (const hike of list) {
          const group = staffHikeGroup(hike, now);
          const lateMs = Math.max(0, now - Date.parse(hike.expectedReturnAt));
          groups[group].push({ ...hike, group, lateMs });
        }
        groups.earlier.reverse(); // the most recent first
        setHikes({ groups, updatedAt: clock(now), error: null });
      })
      .catch((err) => {
        if (ignore) return;
        setHikes({
          groups: emptyGroups(),
          updatedAt: "",
          error: err instanceof Error ? err.message : "Could not load the hikes",
        });
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function refresh() {
    setHikes(null);
    setReloadKey((key) => key + 1);
  }

  const total = hikes
    ? Object.values(hikes.groups).reduce((sum, list) => sum + list.length, 0)
    : 0;

  return (
    <AuthShell
      width="4xl"
      badge="Hut staff"
      title="Registered hikes"
      subtitle="Who is out on the mountain, and who should already be back."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {hikes && !hikes.error ? (
            <p className="text-sm text-stone-600">
              <span className={hikes.groups.overdue.length > 0 ? "font-semibold text-red-700" : ""}>
                {hikes.groups.overdue.length} should be back
              </span>
              {" · "}
              {hikes.groups.out.length} out now
              {" · "}
              {hikes.groups.upcoming.length} upcoming
              <span className="text-stone-400"> · updated {hikes.updatedAt}</span>
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={hikes === null}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50 cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {hikes === null && (
          <div className="space-y-2" aria-label="Loading hikes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-stone-200 animate-pulse" />
            ))}
          </div>
        )}

        {hikes?.error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            Could not load the hikes: {hikes.error}
          </div>
        )}

        {hikes && !hikes.error && total === 0 && (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            No hikes registered yet.
          </p>
        )}

        {hikes &&
          SECTIONS.filter((section) => hikes.groups[section.group].length > 0).map((section) => (
            <section key={section.group} aria-label={section.title}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">
                {section.title}{" "}
                <span className="text-stone-400">({hikes.groups[section.group].length})</span>
              </h2>
              <ul className="space-y-2">
                {hikes.groups[section.group].map((hike) => (
                  <StaffHikeCard key={hike.id} hike={hike} section={section} />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </AuthShell>
  );
}