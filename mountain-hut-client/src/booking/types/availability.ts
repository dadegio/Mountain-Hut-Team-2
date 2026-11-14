export interface AvailabilityTable {
  tableId: number;
  code: string;
  freeSeats: number;
}

export interface Allocation {
  tableId: number;
  code: string;
  seats: number;
}

export interface SlotAvailability {
  slotId: number;
  from: string; // "HH:MM"
  to: string; // "HH:MM"
  availableSeats: number;
  available: boolean; // can this party size be seated?
  tables: AvailabilityTable[];
  allocation: Allocation[] | null;
}

export interface AvailabilityResponse {
  date: string;
  partySize: number;
  slots: SlotAvailability[];
}