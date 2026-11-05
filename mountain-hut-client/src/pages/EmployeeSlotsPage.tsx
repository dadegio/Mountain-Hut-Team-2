import { useEffect, useState } from "react";
import { getSlots, getTables } from "../api/slots";
import AddTableForm from "../components/AddTableForm";
import CreateSlotForm from "../components/CreateSlotForm";
import DayBar from "../components/DayBar";
import SlotList from "../components/SlotList";
import { todayString } from "../utils/date";
import type { Table, TimeSlot } from "../types/slot";

interface SlotsResult {
  date: string;
  slots: TimeSlot[];
  error: string | null;
}

const byStartTime = (a: TimeSlot, b: TimeSlot) => a.from.localeCompare(b.from);

const card = "bg-white border border-stone-200 rounded-lg p-5";

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

      <div className={card}>
        <DayBar date={date} onChange={setDate} />
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
