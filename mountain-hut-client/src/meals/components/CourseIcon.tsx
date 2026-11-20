import type { Course } from "../types/meal.ts";

interface Props {
  course: Course;
  className?: string;
}

export default function CourseIcon({ course, className = "h-5 w-5" }: Props) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (course) {
    case "APPETIZER":
      return (
        <svg {...common}>
          <path d="M4 13h16a8 8 0 0 1-16 0Z" />
          <path d="M9 9c0-2 1-3 3-3s3 1 3 3" />
        </svg>
      );
    case "MAIN":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="7" />
          <circle cx="12" cy="13" r="3.5" />
          <path d="M3 4v5M21 4v16" />
        </svg>
      );
    case "SIDE":
      return (
        <svg {...common}>
          <path d="M12 21c-4-3-6-7-6-11a6 6 0 0 1 12 0c0 4-2 8-6 11Z" />
          <path d="M12 21V9" />
        </svg>
      );
    case "DESSERT":
      return (
        <svg {...common}>
          <path d="M5 11h14l-2 9H7Z" />
          <path d="M7 11a5 5 0 0 1 10 0" />
          <path d="M12 3v3" />
        </svg>
      );
    case "BEVERAGE":
      return (
        <svg {...common}>
          <path d="M6 4h12l-1.5 16h-9Z" />
          <path d="M6.5 9h11" />
        </svg>
      );
  }
}