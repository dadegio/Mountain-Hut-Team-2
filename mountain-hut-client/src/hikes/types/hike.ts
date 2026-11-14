export interface Hike {
  id: number;
  userId: number;
  departureAt: string;
  expectedReturnAt: string; 
  routeDescription: string;
  emergencyContactPhone: string | null;
  createdAt: string;
}

export interface RegisterHikeRequest {
  departureAt: string;
  expectedReturnAt: string;
  routeDescription: string;
  emergencyContactPhone?: string;
}