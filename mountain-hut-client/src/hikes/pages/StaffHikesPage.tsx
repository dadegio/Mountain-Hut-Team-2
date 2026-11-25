import { useEffect, useState } from "react";
import { getRegisteredHikes } from "../api/hikes-api.ts";
import type { StaffHike } from "../types/hike.ts";
import { formatHikeTime, staffHikeGroup } from "../utils/hike-time.ts";
import PageHeader from "../../shared/components/PageHeader.tsx";
import SectionTitle from "../../shared/components/SectionTitle.tsx";
import Icon from "../../shared/components/Icon.tsx";
import { primaryButton, sectionCard as card } from "../../shared/styles.ts";

// MH-21 is about who is on the mountain now; upcoming and past hikes are extra context
type Group = "active" | "upcoming" | "past";

// The hikes of the last load, already grouped and sorted. This is worked out
// when the data arrives, so that rendering never needs the current time.
interface LoadedStaffHikes {
  groups: Record<Group, StaffHike[]>;
  updatedAt: string;
}

function emptyGroups(): Record<Group, StaffHike[]> {
  return { active: [], upcoming: [], past: [] };
}

function groupOf(hike: StaffHike, now: number): Group {
  const group = staffHikeGroup(hike, now);
  if (group === "out" || group === "overdue") return "active";
  if (group === "upcoming") return "upcoming";
  return "past";
}

const time = (iso: string) => Date.parse(iso);

// On a hike: back soonest first · upcoming: leaving soonest first · past: newest first
function sortGroups(groups: Record<Group, StaffHike[]>) {
  groups.active.sort((a, b) => time(a.expectedReturnAt) - time(b.expectedReturnAt));
  groups.upcoming.sort((a, b) => time(a.departureAt) - time(b.departureAt));
  groups.past.sort((a, b) => time(b.departureAt) - time(a.departureAt));
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function StaffHikeCard({ hike, group }: { hike: StaffHike; group: Group }) {
  return (
    <li
      className={`rounded-xl border px-4 py-3 ${
        group === "past" ? "border-stone-200 bg-stone-50" : "border-stone-200 bg-white shadow-sm"
      }`}
    >
      <p className="font-semibold text-stone-900">
        {hike.hiker.name} {hike.hiker.surname}
      </p>
      <p className="text-base font-medium text-green-800">→ {hike.destination}</p>

      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-stone-500">{group === "upcoming" ? "Leaves" : "Left"}</dt>
          <dd className="text-stone-800">{formatHikeTime(hike.departureAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-stone-500">Expected back</dt>
          <dd className="font-semibold text-stone-900">{formatHikeTime(hike.expectedReturnAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-stone-500">Route</dt>
          <dd className="whitespace-pre-line text-stone-800">{hike.routeDescription}</dd>
        </div>
        {hike.intermediatePoints.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-stone-500">Passage points</dt>
            <dd className="text-stone-800">{hike.intermediatePoints.join(" → ")}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-stone-200 pt-2 text-sm">
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

// A list that scrolls inside its card, or a dashed box when it is empty
function HikeList({
  hikes,
  group,
  label,
  empty,
  maxHeight,
}: {
  hikes: StaffHike[];
  group: Group;
  label: string;
  empty: string;
  maxHeight: string;
}) {
  if (hikes.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-stone-300 px-4 py-4 text-center text-sm text-stone-500">
        {empty}
      </p>
    );
  }
  return (
    <ul aria-label={label} className={`space-y-2 overflow-y-auto pr-1 ${maxHeight}`}>
      {hikes.map((hike) => (
        <StaffHikeCard key={hike.id} hike={hike} group={group} />
      ))}
    </ul>
  );
}

export default function StaffHikesPage() {
  const [loaded, setLoaded] = useState<LoadedStaffHikes | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getRegisteredHikes()
      .then((list) => {
        if (!active) return;
        const now = Date.now();
        const groups = emptyGroups();
        for (const hike of list) groups[groupOf(hike, now)].push(hike);
        sortGroups(groups);
        setLoaded({ groups, updatedAt: clock(now) });
        setLoadError(null);
      })
      .catch((err: Error) => {
        if (active) setLoadError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }

  const groups = loaded?.groups;

  return (
    <div className="relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2 space-y-6">
      <PageHeader
        icon="map"
        eyebrow="Staff · Hikes"
        title="Active hikes"
        subtitle="Who is out on the mountain right now, and when they are expected back."
      />

      {loading && !groups ? (
        <p role="status" className={`${card} flex items-center gap-3 text-stone-500`}>
          <span
            className="w-5 h-5 rounded-full border-2 border-green-600 border-t-transparent animate-spin"
            aria-hidden="true"
          />
          Loading hikes…
        </p>
      ) : loadError ? (
        <div role="alert" className={`${card} space-y-3`}>
          <p className="flex items-center gap-2 text-red-700">
            <Icon name="warning" className="w-5 h-5" />
            Could not load the hikes: {loadError}
          </p>
          <button type="button" onClick={refresh} className={primaryButton}>
            <Icon name="repeat" className="w-5 h-5" />
            Retry
          </button>
        </div>
      ) : groups ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
          {/* Right on wide screens, first on phones: this is MH-21 */}
          <section aria-label="On a hike now" className={`${card} space-y-4 lg:order-2`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                icon="clock"
                title={`On a hike now (${groups.active.length})`}
              />
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-400">Updated {loaded?.updatedAt}</span>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-green-600 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50 cursor-pointer"
                >
                  <Icon name="repeat" className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
            <HikeList
              hikes={groups.active}
              group="active"
              label="Hikers on a hike now"
              empty="Nobody is out on a hike right now"
              maxHeight="max-h-[70vh]"
            />
          </section>

          <aside className={`${card} space-y-6 lg:order-1 lg:sticky lg:top-20`} aria-label="Other hikes">
            <section aria-label="Upcoming" className="space-y-4">
              <SectionTitle
                icon="calendar"
                title={`Upcoming (${groups.upcoming.length})`}
              />
              <HikeList
                hikes={groups.upcoming}
                group="upcoming"
                label="Upcoming hikes"
                empty="No upcoming hikes"
                maxHeight="max-h-[30vh]"
              />
            </section>
            <div className="border-t border-stone-200" />
            <section aria-label="Past" className="space-y-4">
              <SectionTitle icon="archive" 
              title={`Past (${groups.past.length})`} 
              />
              <HikeList
                hikes={groups.past}
                group="past"
                label="Past hikes"
                empty="No past hikes"
                maxHeight="max-h-[30vh]"
              />
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}