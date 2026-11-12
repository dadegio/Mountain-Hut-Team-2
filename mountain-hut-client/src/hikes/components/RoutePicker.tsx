import {
  CUSTOM_ROUTE_ID,
  SUGGESTED_ROUTES,
  type SuggestedRoute,
} from "../utils/suggested-routes.ts";

interface RoutePickerProps {
  selectedId: string | null;
  onSelect: (route: SuggestedRoute | null) => void; // null = my own route
}

const DIFFICULTY_CLASS: Record<SuggestedRoute["difficulty"], string> = {
  Easy: "bg-green-100 text-green-800",
  Moderate: "bg-amber-100 text-amber-800",
  Hard: "bg-rose-100 text-rose-800",
};

// Small landscape drawn in code, one per kind of route
function RouteArt({ kind }: { kind: SuggestedRoute["art"] | "custom" }) {
  const common = {
    viewBox: "0 0 200 70",
    preserveAspectRatio: "xMidYMid slice",
    className: "block h-16 w-full",
    "aria-hidden": true,
  } as const;

  if (kind === "lake") {
    return (
      <svg {...common}>
        <rect width="200" height="70" fill="#e0f2fe" />
        <circle cx="160" cy="16" r="7" fill="#fde68a" />
        <path d="M0 46 L35 22 L60 38 L95 14 L130 40 L160 26 L200 42 V70 H0Z" fill="#a7c4bc" />
        <path d="M0 54 Q50 40 100 52 T200 48 V70 H0Z" fill="#5f8f7b" />
        <ellipse cx="100" cy="64" rx="72" ry="8" fill="#60a5fa" />
        <path d="M60 63 H95 M110 66 H138" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "ridge") {
    return (
      <svg {...common}>
        <rect width="200" height="70" fill="#fef3c7" />
        <circle cx="40" cy="18" r="8" fill="#fdba74" />
        <path d="M0 44 L40 26 L70 40 L110 20 L150 38 L200 24 V70 H0Z" fill="#cbd5c0" />
        <path d="M0 52 L30 36 L55 46 L85 28 L110 42 L140 24 L170 40 L200 30 V70 H0Z" fill="#6b8f71" />
        <path
          d="M8 49 L30 38 L55 48 L85 30 L110 44 L140 26 L170 42 L194 33"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "summit") {
    return (
      <svg {...common}>
        <rect width="200" height="70" fill="#e0e7ff" />
        <path d="M0 70 L45 30 L80 70Z" fill="#94a3b8" />
        <path d="M125 70 L165 34 L200 62 V70Z" fill="#94a3b8" />
        <path d="M40 70 L100 8 L160 70Z" fill="#64748b" />
        <path d="M100 8 L85 24 L94 21 L100 28 L106 21 L115 24Z" fill="#ffffff" />
        <path d="M100 8 V0 M100 0 L108 3 L100 6" stroke="#dc2626" strokeWidth="1.5" fill="#dc2626" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect width="200" height="70" fill="#f5f5f4" />
      <path
        d="M10 55 C40 20 70 60 100 35 S160 20 190 40"
        fill="none"
        stroke="#a8a29e"
        strokeWidth="2"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      <circle cx="100" cy="35" r="11" fill="#16a34a" />
      <path d="M100 29 V41 M94 35 H106" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const cardClass = (selected: boolean) =>
  `relative overflow-hidden rounded-xl border bg-white text-left transition cursor-pointer ${
    selected
      ? "border-green-600 ring-2 ring-green-600/40 shadow-md"
      : "border-stone-200 hover:border-green-600 hover:shadow-sm"
  }`;

export default function RoutePicker({ selectedId, onSelect }: RoutePickerProps) {
  return (
    <div role="group" aria-label="Suggested routes" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {SUGGESTED_ROUTES.map((route) => (
        <button
          key={route.id}
          type="button"
          aria-pressed={selectedId === route.id}
          onClick={() => onSelect(route)}
          className={cardClass(selectedId === route.id)}
        >
          <RouteArt kind={route.art} />
          <span
            className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFFICULTY_CLASS[route.difficulty]}`}
          >
            {route.difficulty}
          </span>
          <span className="block px-3 py-2">
            <span className="block text-sm font-semibold text-stone-900">{route.name}</span>
            <span className="block text-xs text-stone-500">
              {route.hours} h · {route.distanceKm} km · +{route.ascentM} m
            </span>
          </span>
        </button>
      ))}

      <button
        type="button"
        aria-pressed={selectedId === CUSTOM_ROUTE_ID}
        onClick={() => onSelect(null)}
        className={cardClass(selectedId === CUSTOM_ROUTE_ID)}
      >
        <RouteArt kind="custom" />
        <span className="block px-3 py-2">
          <span className="block text-sm font-semibold text-stone-900">My own route</span>
          <span className="block text-xs text-stone-500">Describe it yourself</span>
        </span>
      </button>
    </div>
  );
}