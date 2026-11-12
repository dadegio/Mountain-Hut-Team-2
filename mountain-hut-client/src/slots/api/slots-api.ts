import { ApiError, apiFetch } from "../../shared/api/client.ts";
import { todayString } from "../../shared/utils/date.ts";
import type {
  CreateSlotRequest,
  CopyWeekRequest,
  CopyWeekResult,
  CreateTableRequest,
  Table,
  TimeSlot,
} from "../types/slot.ts";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Same tables as the backend seed
const mockTables: Table[] = [
  { id: 1, code: "T1", seats: 2 },
  { id: 2, code: "T2", seats: 2 },
  { id: 3, code: "T3", seats: 4 },
  { id: 4, code: "T4", seats: 4 },
  { id: 5, code: "T5", seats: 6 },
  { id: 6, code: "T6", seats: 8 },
];

const mockSlots: TimeSlot[] = [
  {
    id: 1,
    date: todayString(),
    from: "12:00",
    to: "14:00",
    totalSeats: 12,
    tables: mockTables.slice(0, 4),
  },
];

export async function getTables(): Promise<Table[]> {
  if (USE_MOCKS) {
    await delay(300);
    return [...mockTables];
  }
  return apiFetch<Table[]>("/tables");
}

export async function createTable(data: CreateTableRequest): Promise<Table> {
  if (USE_MOCKS) {
    await delay(300);
    if (mockTables.some((t) => t.code === data.code)) {
      throw new ApiError(409, `Table code ${data.code} already exists`);
    }
    const table = { id: mockTables.length + 1, ...data };
    mockTables.push(table);
    return table;
  }
  return apiFetch<Table>("/tables", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSlots(date: string): Promise<TimeSlot[]> {
  if (USE_MOCKS) {
    await delay(300);
    return mockSlots
      .filter((s) => s.date === date)
      .sort((a, b) => a.from.localeCompare(b.from));
  }
  return apiFetch<TimeSlot[]>(`/slots?date=${encodeURIComponent(date)}`);
}

export async function createSlot(data: CreateSlotRequest): Promise<TimeSlot> {
  if (USE_MOCKS) {
    await delay(300);
    // Only the overlap rule is mocked, the backend checks everything else
    const clash = mockSlots.find(
      (s) => s.date === data.date && s.from < data.to && data.from < s.to,
    );
    if (clash) {
      throw new ApiError(409, `Slot overlaps with existing slot ${clash.from}-${clash.to}`);
    }
    const tables = mockTables.filter((t) => data.tableIds.includes(t.id));
    const slot: TimeSlot = {
      id: mockSlots.length + 1,
      date: data.date,
      from: data.from,
      to: data.to,
      totalSeats: tables.reduce((sum, t) => sum + t.seats, 0),
      tables,
    };
    mockSlots.push(slot);
    return slot;
  }
  return apiFetch<TimeSlot>("/slots", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Repeats slots and their table associations; existing bookings are not copied. */
export async function copyWeek(input: CopyWeekRequest): Promise<CopyWeekResult> {
  if (USE_MOCKS) {
    await delay(300);
    const toMs = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
    const datePlus = (date: string, days: number) => new Date(toMs(date) + days * 86400000).toISOString().slice(0, 10);
    const lastSourceDay = datePlus(input.sourceWeekStart, 6);
    const lastTargetDay = datePlus(input.targetWeekStart, input.weeks * 7 - 1);
    if (input.targetWeekStart <= lastSourceDay && input.sourceWeekStart <= lastTargetDay) {
      throw new ApiError(400, "Source and destination weeks must not overlap");
    }
    const source = mockSlots.filter((slot) =>
      slot.date >= input.sourceWeekStart && slot.date <= lastSourceDay,
    );
    if (source.length === 0) throw new ApiError(404, "Source week has no slots");
    const copied = Array.from({ length: input.weeks }, (_, week) =>
      source.map((slot) => {
        const dayOffset = Math.round((toMs(slot.date) - toMs(input.sourceWeekStart)) / 86400000);
        const date = datePlus(input.targetWeekStart, week * 7 + dayOffset);
        return { ...slot, date, id: 0, tables: [...slot.tables] };
      }),
    ).flat();
    if (copied.some((slot) => mockSlots.some((existing) =>
      existing.date === slot.date && existing.from < slot.to && slot.from < existing.to,
    ))) throw new ApiError(409, "Destination slot overlaps with an existing slot");
    let nextId = Math.max(0, ...mockSlots.map((slot) => slot.id)) + 1;
    for (const slot of copied) mockSlots.push({ ...slot, id: nextId++ });
    return { ...input, copiedSlots: copied.length };
  }
  return apiFetch<CopyWeekResult>("/slots/copy-week", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
