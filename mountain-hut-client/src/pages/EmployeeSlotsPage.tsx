import { useEffect, useState } from "react";
import { getSlots, getTables } from "../api/slots.ts";
import AddTableForm from "../components/slots/AddTableForm";
import CreateSlotForm from "../components/slots/CreateSlotForm";
import SlotList from "../components/slots/SlotList";
import { formatDay, openPicker, shiftDate, todayString } from "../utils/date.ts";
import type { Table, TimeSlot } from "../types/slot.ts";

interface SlotsResult {
  date: string;
  slots: TimeSlot[];
  error: string | null;
}

const byStartTime = (a: TimeSlot, b: TimeSlot) => a.from.localeCompare(b.from);

const card = "bg-white border border-stone-200 rounded-lg p-5";
const dayButton =
  "px-3 py-1.5 rounded border border-stone-300 bg-white text-sm hover:border-green-600";

// TODO(MH-7): restrict this page to EMPLOYEE and MANAGER
export default function EmployeeSlotsPage() {
  const [date, setDate] = useState(todayString());
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  // Remembers which date the slots belong to: while it differs from `date`
  // the slots of the newly chosen day are still loading
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);

  useEffect(() => {
    let ignore = false;

    getTables()
      .then((data) => {
        if (!ignore) setTables(data);
      })
      .catch((err: Error) => {
        if (!ignore) setTablesError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    getSlots(date)
      .then((slots) => {
        if (!ignore) setSlotsResult({ date, slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setSlotsResult({ date, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date]);

  const loadingSlots = slotsResult?.date !== date;
  const today = todayString();

  function handleSlotCreated(slot: TimeSlot) {
    setSlotsResult((current) =>
      current && current.date === slot.date
        ? { ...current, slots: [...current.slots, slot].sort(byStartTime) }
        : current,
    );
  }

  return (
    // Wider than the default layout column: the page needs room for the table grid
    <div className="relative left-1/2 -translate-x-1/2 w-[min(80rem,calc(100vw-2rem))] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Slots and tables</h1>
        <p className="text-stone-600">Hikers can only book the slots defined here.</p>
      </div>

      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => setDate(shiftDate(date, -1))}
          className={dayButton}
        >
          ←
        </button>
        <input
          type="date"
          aria-label="Day"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          onClick={(e) => openPicker(e.currentTarget)}
          className="border border-stone-300 rounded px-3 py-2 bg-white cursor-pointer hover:border-green-600"
        />
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDate(shiftDate(date, 1))}
          className={dayButton}
        >
          →
        </button>
        <button type="button" onClick={() => setDate(today)} className={dayButton}>
          Today
        </button>
        <button
          type="button"
          onClick={() => setDate(shiftDate(today, 1))}
          className={dayButton}
        >
          Tomorrow
        </button>
        <p className="text-xl font-semibold sm:ml-auto">{formatDay(date)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr] items-start">
        <section className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold">Slots of the day</h2>
          {loadingSlots ? (
            <p className="text-stone-500">Loading…</p>
          ) : slotsResult.error ? (
            <p className="text-red-600">Error: {slotsResult.error}</p>
          ) : (
            <SlotList slots={slotsResult.slots} />
          )}
        </section>

        <div className="space-y-6">
          <section className={`${card} space-y-4`}>
            <h2 className="text-lg font-semibold">New slot</h2>
            {tablesError ? (
              <p className="text-red-600">Error: {tablesError}</p>
            ) : (
              <CreateSlotForm
                // A new day starts with an empty form
                key={date}
                date={date}
                tables={tables}
                onCreated={handleSlotCreated}
              />
            )}
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className="text-lg font-semibold">Add a table</h2>
            <AddTableForm onCreated={(table) => setTables((ts) => [...ts, table])} />
          </section>
        </div>
      </div>
    </div>
  );
}
