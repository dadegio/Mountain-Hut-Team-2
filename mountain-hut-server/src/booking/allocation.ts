
export interface FreeTable {
  tableId: number;
  code: string;
  freeSeats: number;
}

export interface SeatAssignment {
  tableId: number;
  code: string;
  seats: number;
}

/**
 * Allocates seats for a party.
 *
 * Rules:
 * 1. Prefer a single table whenever possible.
 * 2. Choose the smallest sufficient table.
 * 3. If splitting is necessary, use the fewest tables.
 * 4. Among equivalent solutions, minimize unused capacity.
 *
 * Returns null when there are not enough available seats.
 */
export function allocateTables(
  tables: FreeTable[],
  partySize: number
): SeatAssignment[] | null {

  // Validate party size
  if (!Number.isSafeInteger(partySize) || partySize <= 0) {
    return null;
  }

  // Consider only tables with available seats
  const availableTables = tables
    .filter(
      (table) =>
        Number.isSafeInteger(table.freeSeats) &&
        table.freeSeats > 0
    )
    .sort((a, b) => a.tableId - b.tableId);

  // STEP 1: Try to allocate the whole party to one table
  const singleTable = availableTables
    .filter((table) => table.freeSeats >= partySize)
    .sort(
      (a, b) =>
        a.freeSeats - b.freeSeats || a.tableId - b.tableId
    )[0];

  if (singleTable) {
    return [{
      tableId: singleTable.tableId,
      code: singleTable.code,
      seats: partySize
    }];
  }

  // STEP 2: Find the best combination of multiple tables
  // Key: total available capacity
  // Value: indices of selected tables
  const combinations = new Map<number, number[]>([
    [0, []]
  ]);

  availableTables.forEach((table, index) => {
    const existing = [...combinations.entries()];

    for (const [capacity, selected] of existing) {
      const newCapacity = capacity + table.freeSeats;
      const candidate = [...selected, index];
      const previous = combinations.get(newCapacity);

      if (!previous || candidate.length < previous.length) {
        combinations.set(newCapacity, candidate);
      }
    }
  });

  // Prefer fewer tables, then less excess capacity
  const best = [...combinations.entries()]
    .filter(([capacity]) => capacity >= partySize)
    .sort(
      ([capacityA, tablesA], [capacityB, tablesB]) =>
        tablesA.length - tablesB.length ||
        capacityA - capacityB
    )[0];

  if (!best) {
    return null;
  }

  // STEP 3: Allocate only the required number of seats
  let remaining = partySize;

  const selectedTables = best[1]
    .map((index) => availableTables[index])
    .sort(
      (a, b) =>
        a.freeSeats - b.freeSeats || a.tableId - b.tableId
    );

  const allocation: SeatAssignment[] = [];

  for (const table of selectedTables) {
    if (remaining === 0) break;

    const assignedSeats = Math.min(remaining, table.freeSeats);

    allocation.push({
      tableId: table.tableId,
      code: table.code,
      seats: assignedSeats
    });

    remaining -= assignedSeats;
  }

  return allocation;
}
