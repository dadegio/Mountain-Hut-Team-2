import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ApiError } from "../../shared/api/client.ts";
import AuthShell from "../../shared/components/AuthShell.tsx";
import { registerHike } from "../api/hikes-api.ts";
import RoutePicker from "../components/RoutePicker.tsx";
import type { Hike } from "../types/hike.ts";
import {
  addHours,
  formatDuration,
  formatHikeRange,
  formatHikeTime,
  localInputToIso,
  nextFullHour,
  validateHikeForm,
} from "../utils/hike-time.ts";
import {
  CUSTOM_ROUTE_ID,
  SUGGESTED_ROUTES,
  type SuggestedRoute,
} from "../utils/suggested-routes.ts";

const MAX_ROUTE_LENGTH = 2000;
const HOUR_MS = 60 * 60 * 1000;
const RETURN_PRESETS = [3, 5, 8, 12]; // hours after departure

const primaryButton =
  "w-full inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer";

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-xs placeholder:text-stone-400 focus:border-green-600 focus:outline-hidden focus:ring-2 focus:ring-green-600/30";

function SectionLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  const className = "block text-xs font-semibold uppercase tracking-wider text-green-700 mb-1.5";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  ) : (
    <p className={className}>{children}</p>
  );
}

function registerErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401: return "Please log in to register a hike.";
      case 403: return "Only hikers can register a hike.";
      case 400: return err.message;
    }
  }
  return "Something went wrong. Please try again.";
}

export default function RegisterHikePage() {
  const [routeId, setRouteId] = useState<string | null>(null);
  const [route, setRoute] = useState("");
  const [departure, setDeparture] = useState(nextFullHour);
  const [expectedReturn, setExpectedReturn] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Hike | null>(null);

  const departureMs = Date.parse(departure);
  const returnMs = Date.parse(expectedReturn);
  const hasRange = Number.isFinite(departureMs) && Number.isFinite(returnMs);
  const durationMs = returnMs - departureMs;
  const reversed = hasRange && durationMs <= 0;
  const suggested = SUGGESTED_ROUTES.find((r) => r.id === routeId) ?? null;

  // A suggested route fills in its description and, once the departure is
  // known, the expected return. Both stay editable.
  function handleRouteSelect(picked: SuggestedRoute | null) {
    if (picked === null) {
      setRouteId(CUSTOM_ROUTE_ID);
      // Keep what the hiker typed, but drop the text of a suggested route
      if (SUGGESTED_ROUTES.some((r) => r.description === route)) setRoute("");
      return;
    }
    setRouteId(picked.id);
    setRoute(picked.description);
    if (departure) setExpectedReturn(addHours(departure, picked.hours));
  }

  function handleDepartureChange(value: string) {
    setDeparture(value);
    if (suggested && value) setExpectedReturn(addHours(value, suggested.hours));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const problem = validateHikeForm(
      { route, departure, expectedReturn, phone },
      Date.now(),
    );
    if (problem) {
      setFormError(problem);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setRegistered(null);
    try {
      const contact = phone.trim();
      const hike = await registerHike({
        departureAt: localInputToIso(departure)!,
        expectedReturnAt: localInputToIso(expectedReturn)!,
        routeDescription: route.trim(),
        ...(contact ? { emergencyContactPhone: contact } : {}),
      });
      setRegistered(hike);
      setRouteId(null);
      setRoute("");
      setDeparture(nextFullHour());
      setExpectedReturn("");
      setPhone("");
    } catch (err) {
      setFormError(registerErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      width="4xl"
      badge="Safety"
      title="Register a hike"
      subtitle="Tell the hut where you are going and when you plan to be back."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {registered && (
          <div
            role="status"
            className="flex gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-900"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <p>
              <span className="font-semibold">Hike registered.</span> The hut expects you back by{" "}
              {formatHikeTime(registered.expectedReturnAt)}.{" "}
              <Link to="/my-hikes" className="font-semibold text-green-700 underline">
                See my hikes
              </Link>
            </p>
          </div>
        )}

        <div>
          <SectionLabel>Choose a route</SectionLabel>
          <RoutePicker selectedId={routeId} onSelect={handleRouteSelect} />
        </div>

        <div className="grid gap-5 md:grid-cols-2 md:gap-8">
          {/* Left: where */}
          <div className="flex flex-col gap-4 md:border-r md:border-stone-200 md:pr-8">
            <div>
              <SectionLabel htmlFor="routeDescription">Route details</SectionLabel>
              <textarea
                id="routeDescription"
                rows={3}
                maxLength={MAX_ROUTE_LENGTH}
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. From the hut to the lake on trail 12, then back along the ridge"
                className={`${inputClass} field-sizing-content min-h-20 resize-none`}
              />
              <div className="mt-1 flex justify-between gap-4 text-xs text-stone-500">
                <span>Add any detours or stops you plan.</span>
                <span>{route.length}/{MAX_ROUTE_LENGTH}</span>
              </div>
            </div>

            <div>
              <SectionLabel htmlFor="emergencyContactPhone">Emergency contact (optional)</SectionLabel>
              <input
                id="emergencyContactPhone"
                type="tel"
                inputMode="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+39 333 123 4567"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-stone-500">
                Someone the hut can call if you can't be reached.
              </p>
            </div>
          </div>

          {/* Right: when */}
          <div className="flex flex-col gap-4">
            <div>
              <SectionLabel htmlFor="departureAt">Departure</SectionLabel>
              <input
                id="departureAt"
                type="datetime-local"
                value={departure}
                onChange={(e) => handleDepartureChange(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <SectionLabel htmlFor="expectedReturnAt">Expected return</SectionLabel>
              <input
                id="expectedReturnAt"
                type="datetime-local"
                value={expectedReturn}
                min={departure || undefined}
                onChange={(e) => setExpectedReturn(e.target.value)}
                aria-invalid={reversed}
                className={`${inputClass} ${reversed ? "border-amber-500" : ""}`}
              />
              <div role="group" aria-label="Back in" className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-stone-600">Back in</span>
                {RETURN_PRESETS.map((hours) => {
                  const selected = hasRange && durationMs === hours * HOUR_MS;
                  return (
                    <button
                      key={hours}
                      type="button"
                      aria-pressed={selected}
                      disabled={!Number.isFinite(departureMs)}
                      onClick={() => setExpectedReturn(addHours(departure, hours))}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? "bg-green-600 text-white shadow-sm"
                          : "border border-stone-300 bg-white text-stone-700 hover:border-green-600 hover:text-green-700"
                      }`}
                    >
                      {hours} h
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto space-y-3">
              {hasRange && !reversed && (
                <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900">
                  {formatHikeRange(departure, expectedReturn)} · out for {formatDuration(durationMs)}
                </p>
              )}

              {reversed && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  The expected return must be after the departure.
                </p>
              )}

              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <button type="submit" disabled={submitting} className={primaryButton}>
                {submitting ? "Registering…" : "Register hike"}
              </button>

              <p className="text-center text-xs text-stone-500">
                Only hut staff can see your route and contact details.
              </p>
            </div>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}