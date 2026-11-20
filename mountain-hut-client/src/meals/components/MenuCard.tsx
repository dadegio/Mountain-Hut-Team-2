import type { CSSProperties } from "react";
import type { Course, MealDish, MealMenu } from "../types/meal.ts";
import { COURSE_LABELS, COURSE_ORDER } from "../utils/meal-rules.ts";
import CourseIcon from "./CourseIcon.tsx";

interface Props {
  menu: MealMenu;
  avoid: number[];
  style?: CSSProperties;
}

interface CourseGroup {
  course: Course;
  dishes: MealDish[];
}

export default function MenuCard({ menu, avoid, style }: Props) {
  const conflicts = menu.allergens.filter((a) => avoid.includes(a.id));
  const hasConflict = conflicts.length > 0;
  const filtering = avoid.length > 0;

  const courses: CourseGroup[] = COURSE_ORDER.map((course) => ({
    course,
    dishes: menu.dishes.filter((d) => d.course === course),
  })).filter((g) => g.dishes.length > 0);

  return (
    <article
      aria-label={menu.name}
      style={style}
      className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition duration-300 motion-safe:animate-fade-up motion-safe:hover:-translate-y-1 hover:shadow-lg ${
        hasConflict ? "border-red-400 ring-4 ring-red-100" : "border-stone-200"
      }`}
    >
      {/* Header */}
      <header
        className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
          hasConflict ? "border-red-200 bg-red-50" : "border-stone-100"
        }`}
      >
        <div>
          <h2 className={`text-base font-semibold leading-snug ${hasConflict ? "text-red-800" : "text-stone-900"}`}>
            {menu.name}
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            {menu.dishes.length} {menu.dishes.length === 1 ? "dish" : "dishes"}
          </p>
        </div>
        {filtering && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold motion-safe:animate-pop-in ${
              hasConflict ? "bg-red-600 text-white" : "bg-green-600 text-white"
            }`}
          >
            {hasConflict
              ? `Contains ${conflicts.map((a) => a.name).join(", ")}`
              : "✓ Suits your party"}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 space-y-5 px-5 py-4">
        <p className="text-sm text-stone-600">
          {menu.allergens.length === 0 ? (
            "No listed allergens"
          ) : (
            <>
              <span className="font-medium text-stone-700">Allergens: </span>
              {menu.allergens.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <span
                    className={
                      avoid.includes(a.id) ? "rounded bg-red-100 px-1 font-semibold text-red-700" : ""
                    }
                  >
                    {a.name}
                  </span>
                </span>
              ))}
            </>
          )}
        </p>

        {courses.map(({ course, dishes }) => (
          <section key={course} aria-label={COURSE_LABELS[course]}>
            <h5 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              <CourseIcon course={course} className="h-4 w-4" />
              {COURSE_LABELS[course]}
            </h5>
            <ul className="space-y-3">
              {dishes.map((dish) => {
                const dishConflict = dish.allergens.some((a) => avoid.includes(a.id));
                return (
                  <li
                    key={dish.id}
                    className={`rounded-lg px-3 py-2 ${
                      dishConflict ? "border-l-4 border-red-500 bg-red-50" : ""
                    }`}
                  >
                    <p className={`text-base font-medium ${dishConflict ? "text-red-800" : "text-stone-900"}`}>
                      {dish.name}
                    </p>
                    {dish.description && (
                      <p className="text-sm text-stone-500">{dish.description}</p>
                    )}
                    {dish.allergens.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {dish.allergens.map((a) => (
                          <span
                            key={a.id}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              avoid.includes(a.id)
                                ? "bg-red-600 text-white"
                                : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}