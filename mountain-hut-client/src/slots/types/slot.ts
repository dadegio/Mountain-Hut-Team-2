// Matches the backend table and slot API (MH-33)
export interface Table {
  id: number;
  code: string; // e.g. "T1"
  seats: number;
}

export interface TimeSlot {
  id: number;
  date: string; // "YYYY-MM-DD"
  from: string; // "HH:MM"
  to: string; // "HH:MM"
  totalSeats: number;
  tables: Table[];
}

export interface CreateTableRequest {
  code: string;
  seats: number;
}

export interface CreateSlotRequest {
  date: string;
  from: string;
  to: string;
  tableIds: number[];
}
