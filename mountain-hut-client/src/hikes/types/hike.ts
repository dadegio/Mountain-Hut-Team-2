// MH-139 / MH-22 hike API contract
export type HikeOutcome = "COMPLETED" | "CANCELLED";

export interface Hike {
  id: number;
  userId: number;
  departureAt: string;
  expectedReturnAt: string; 
  destination: string;
  routeDescription: string;
  intermediatePoints: string[];
  emergencyContactPhone: string | null;
  createdAt: string;
  completedAt?: string | null;
  outcome?: HikeOutcome | null;
}

export interface RegisterHikeRequest {
  departureAt: string;
  expectedReturnAt: string;
  destination: string;
  routeDescription: string;
  intermediatePoints?: string[];
  emergencyContactPhone?: string;
}