import { useEffect, useState, type CSSProperties } from "react";
import AuthShell from "../../shared/components/AuthShell.tsx";
import Icon from "../../shared/components/Icon.tsx";
import { todayString } from "../../shared/utils/date.ts";
import { getAllergens } from "../../booking/api/allergens-api.ts";
import type { Allergen } from "../../booking/types/booking.ts";
import { getMeals } from "../api/meals-api.ts";
import AllergenFilter from "../components/AllergenFilter.tsx";
import MenuCard from "../components/MenuCard.tsx";
import type { MealTime } from "../types/meal.ts";
import {
  dayChipLabel,
  dayNumber,
  longDayLabel,
  mealLabel,
  menuSuits,
  nextDays,
  sortBySuitability,
  weekdayShort,
} from "../utils/meal-rules.ts";

const DAYS_SHOWN = 7;
const STAGGER_MS = 80;

// The meals of the last load, tagged with their day: while it differs from
// the chosen day, that day is still loading
interface LoadedMeals {
  date: string;
  meals: MealTime[];
  error: string | null;
}

// Decorative only: afternoon meals and later get a moon, earlier ones a sun
const isEvening = (from: string) => Number(from.slice(0, 2)) >= 16;

function EmptyPlate() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 80" className="mx-auto h-20 w-28 text-stone-300">
      <ellipse cx="60" cy="44" rx="38" ry="26" fill="currentColor" opacity="0.35" />
      <ellipse cx="60" cy="44" rx="26" ry="17" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M12 20 V60 M8 20 V32 M16 20 V32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M108 60 V20 C114 24 114 36 108 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function SuitSummary({ suiting, total }: { suiting: number; total: number }) {
  if (suiting === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-base font-medium text-red-700 motion-safe:animate-pop-in">
        <Icon name="warning" className="w-5 h-5" />
        No menu suits your party, so ask the hut staff about alternatives.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-base text-stone-600 motion-safe:animate-pop-in">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">
        <Icon name="check" className="w-4 h-4" />
      </span>
      {suiting} of {total} {total === 1 ? "menu suits" : "menus suit"} your party
    </p>
  );
}

const delay = (i: number): CSSProperties => ({ animationDelay: `${i * STAGGER_MS}ms` });

export default function MealsPage() {
  const [date, setDate] = useState(todayString);
  const [dateError, setDateError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedMeals | null>(null);
  const [allergens, setAllergens] = useState<Allergen[] | null>(null);
  const [allergensError, setAllergensError] = useState(false);
  const [avoid, setAvoid] = useState<number[]>([]);

  useEffect(() => {
    let ignore = false;
    getMeals(date)
      .then((meals) => {
        if (!ignore) setLoaded({ date, meals, error: null });
      })
      .catch((err) => {
        if (!ignore) {
          setLoaded({
            date,
            meals: [],
            error: err instanceof Error ? err.message : "Could not load the meals",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [date]);

  useEffect(() => {
    let ignore = false;
    getAllergens()
      .then((list) => {
        if (!ignore) setAllergens(list);
      })
      .catch(() => {
        if (!ignore) setAllergensError(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function toggleAvoid(id: number) {
    setAvoid((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function pickDate(value: string) {
    if (!value) return;
    if (value < todayString()) {
      setDateError("Pick today or a later day");
      return;
    }
    setDateError(null);
    setDate(value);
  }

  const today = todayString();
  const days = nextDays(today, DAYS_SHOWN);
  const current = loaded && loaded.date === date ? loaded : null;
  const mealCount = current && !current.error ? current.meals.length : 0;

  return (
    <AuthShell
      width="5xl"
      badge="Hut kitchen"
      title="Meal times & menus"
      subtitle="See when the hut serves meals and what's on the menu, and find the options that suit your party."
    >
      <div className="space-y-7">
        {/* Day */}
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Day" className="flex flex-wrap gap-2">
            {days.map((day) => {
              const selected = day === date;
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  aria-label={dayChipLabel(day, today)}
                  onClick={() => { setDateError(null); setDate(day); } }
                  className={`w-16 rounded-xl px-2 py-2.5 text-center transition duration-200 cursor-pointer ${
                    selected
                      ? "bg-green-600 text-white shadow-md motion-safe:scale-105"
                      : "border border-stone-200 bg-white text-stone-700 hover:border-green-600 hover:text-green-700 motion-safe:hover:-translate-y-0.5"
                  }`}
                >
                  <span
                    className={`block text-xs font-medium uppercase tracking-wide ${
                      selected ? "text-green-100" : "text-stone-500"
                    }`}
                  >
                    {day === today ? "Today" : weekdayShort(day)}
                  </span>
                  <span className="block text-2xl font-semibold leading-tight">{dayNumber(day)}</span>
                </button>
              );
            })}
          </div>
          <label className="ml-auto flex items-center gap-2 text-base text-stone-600">
            <Icon name="calendar" className="w-5 h-5 text-green-700" />
            Other day
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => pickDate(e.target.value)}
              aria-invalid={dateError !== null}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-stone-900"
            />
          </label>
          {dateError && (
              <p role="alert" className="text-sm text-red-600">
                {dateError}
              </p>
            )}
        </div>

        <AllergenFilter
          allergens={allergens}
          loadError={allergensError}
          selected={avoid}
          onToggle={toggleAvoid}
          onClear={() => setAvoid([])}
        />

        <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <h2 key={date} className="flex items-center gap-2 text-xl font-semibold text-stone-900 motion-safe:animate-fade-up">
            <Icon name="calendar" className="w-6 h-6 text-green-700" />
            {longDayLabel(date)}
          </h2>
          {mealCount > 0 && (
            <p className="text-base text-stone-500">
              {mealCount} {mealCount === 1 ? "meal time" : "meal times"}
            </p>
          )}
        </div>

        {current === null && (
          <div className="space-y-3" aria-label="Loading meals">
            {[0, 1].map((i) => (
              <div key={i} className="h-56 rounded-2xl bg-stone-200 animate-pulse" />
            ))}
          </div>
        )}

        {current?.error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            <Icon name="warning" className="w-5 h-5" />
            Could not load the meals: {current.error}
          </div>
        )}

        {current && !current.error && current.meals.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-10 text-center motion-safe:animate-fade-up">
            <EmptyPlate />
            <p className="mt-2 text-base text-stone-500">No meal times on this day.</p>
          </div>
        )}

        {/* Keyed by day, so the animations play again when the day changes */}
        <div key={date} className="space-y-10">
          {current?.meals.map((meal, i) => {
            const menus = sortBySuitability(meal.menus, avoid);
            const suiting = meal.menus.filter((m) => menuSuits(m, avoid)).length;
            const evening = isEvening(meal.from);
            return (
              <section
                key={meal.slotId}
                aria-label={`Meal ${meal.from}–${meal.to}`}
                style={delay(i)}
                className="space-y-4 motion-safe:animate-fade-up"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      evening ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    <Icon name={evening ? "moon" : "sun"} className="w-7 h-7" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">{mealLabel(meal.from)}</h3>
                    <p className="flex items-center gap-1.5 text-base text-stone-500">
                      <Icon name="clock" className="w-4 h-4" />
                      {meal.from}–{meal.to}
                      {meal.menus.length > 0 &&
                        ` · ${meal.menus.length} ${meal.menus.length === 1 ? "menu" : "menus"}`}
                    </p>
                  </div>
                </div>

                {meal.menus.length > 0 && avoid.length > 0 && (
                  <SuitSummary suiting={suiting} total={meal.menus.length} />
                )}

                {meal.menus.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-5 text-base text-stone-500">
                    <Icon name="book" className="w-5 h-5 text-stone-400" />
                    The menu for this meal time hasn't been announced yet.
                  </p>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {menus.map((menu, j) => (
                      <MenuCard
                        key={menu.id}
                        menu={menu}
                        avoid={avoid}
                        style={{ animationDelay: `${(i + j + 1) * STAGGER_MS}ms` }}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </AuthShell>
  );
}