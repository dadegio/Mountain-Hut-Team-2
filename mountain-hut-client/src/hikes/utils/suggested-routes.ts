// Example routes offered on the register page. Only the description is sent
// to the backend; the rest is shown to help the hiker choose.
// TODO: replace with the real routes around the hut (ask the PO).
export interface SuggestedRoute {
  id: string;
  art: "lake" | "ridge" | "summit";
  name: string;
  difficulty: "Easy" | "Moderate" | "Hard";
  hours: number; // usual time out, also used to suggest the return
  distanceKm: number;
  ascentM: number;
  description: string;
}

export const SUGGESTED_ROUTES: SuggestedRoute[] = [
  {
    id: "lake",
    art: "lake",
    name: "Lake loop",
    difficulty: "Easy",
    hours: 3,
    distanceKm: 7,
    ascentM: 250,
    description:
      "Lake loop: from the hut down trail 12 to the lake, around the shore and back on the same trail.",
  },
  {
    id: "ridge",
    art: "ridge",
    name: "Ridge walk",
    difficulty: "Moderate",
    hours: 5,
    distanceKm: 11,
    ascentM: 600,
    description:
      "Ridge walk: trail 14 up to the pass, along the ridge to the viewpoint, then back down trail 12.",
  },
  {
    id: "summit",
    art: "summit",
    name: "Summit trail",
    difficulty: "Hard",
    hours: 8,
    distanceKm: 14,
    ascentM: 1100,
    description:
      "Summit trail: trail 14 to the pass, then the marked summit path to the top and back the same way.",
  },
];

export const CUSTOM_ROUTE_ID = "custom";