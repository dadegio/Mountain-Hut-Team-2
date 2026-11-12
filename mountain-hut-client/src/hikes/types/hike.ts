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

// GET /hikes (staff only): a hike with the hiker's contact details
export interface StaffHike extends Hike {
  hiker: {
    name: string;
    surname: string;
    phoneNumber: string | null;
  };
}