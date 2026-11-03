import { describe, it, expect } from "vitest";
import { allocateTables, type FreeTable } from "./allocation.ts";

// EDGE CASES
describe("allocateTables - Input validation (invalid partySize)", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 4 },
    ];

    it("should return null when partySize is 0", () => {
        const result = allocateTables(dummyTables, 0);
        expect(result).toBeNull();
    });

    it("should return null when partySize is negative", () => {
        const result = allocateTables(dummyTables, -1);
        expect(result).toBeNull();
    });

    it("should return null when partySize is not an integer (float)", () => {
        const result = allocateTables(dummyTables, 2.5);
        expect(result).toBeNull();
    });

    it("should return null when partySize is not an integer (NaN)", () => {
        const result = allocateTables(dummyTables, NaN);
        expect(result).toBeNull();
    });

    it("should return null when partySize is not an integer (Infinity)", () => {
        const result = allocateTables(dummyTables, Infinity);
        expect(result).toBeNull();
    });

    it("should return null when partySize is not an integer (-Infinity)", () => {
        const result = allocateTables(dummyTables, -Infinity);
        expect(result).toBeNull();
    });
});

describe("allocateTables - Input validation (No available table)", () => {
    const dummyTables: FreeTable[] = [];

    it("should return null when there is no available table", () => {
        const result = allocateTables(dummyTables, 4);
        expect(result).toBeNull();
    });
});

describe("allocateTables - Input validation (Tables with a non-valid freeSeats value)", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 0 },
        { tableId: 2, code: "T2", freeSeats: 0 }
    ];

    it("should return null when tables have no seats", () => {
        const result = allocateTables(dummyTables, 4);
        expect(result).toBeNull();
    });
});

describe("allocateTables - Input validation (Tables with a non-valid freeSeats value)", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: -1 },
        { tableId: 2, code: "T2", freeSeats: -2 }
    ];

    it("should return null when tables have a negative number of seats", () => {
        const result = allocateTables(dummyTables, 4);
        expect(result).toBeNull();
    });
});

describe("allocateTables - Input validation (Not enough available seats)", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 8 }
    ];

    it("should return null when there are not enough available seats", () => {
        const result = allocateTables(dummyTables, 10);
        expect(result).toBeNull();
    });
});

// PERFECT MATCH
describe("allocateTables - Single table allocation", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 4 },
        { tableId: 2, code: "T2", freeSeats: 5 }
    ];

    it("should return the perfect match when there is a table with exactly the same seats required", () => {
        const result = allocateTables(dummyTables, 4);
        expect(result).toEqual([
            { code: "T1", seats: 4, tableId: 1 }
        ]);
    });
});

// MINIMIZING THE WASTE
describe("allocateTables - Choosing the smallest table to fit in the party", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 6 },
        { tableId: 2, code: "T2", freeSeats: 4 },
        { tableId: 3, code: "T3", freeSeats: 8 },
    ];

    it("should return the smallest table in order to fit in everyone", () => {
        const result = allocateTables(dummyTables, 3);
        expect(result).toEqual([
            { code: "T2", seats: 3, tableId: 2 }
        ]);
    });
});

// TIE-BREAKING
describe("allocateTables - Tie-breaking", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 4 },
        { tableId: 2, code: "T2", freeSeats: 4 },
        { tableId: 3, code: "T3", freeSeats: 8 },
    ];

    it("should return the table with the lowest tableId", () => {
        const result = allocateTables(dummyTables, 3);
        expect(result).toEqual([
            { code: "T1", seats: 3, tableId: 1 }
        ]);
    });
});

// BETTER ONE TABLE THAN A COMBINATION
describe("allocateTables - Choosing one table rather than a combination", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 2 },
        { tableId: 2, code: "T2", freeSeats: 2 },
        { tableId: 3, code: "T3", freeSeats: 4 },
    ];

    it("should return only one table rather than a combination of others", () => {
        const result = allocateTables(dummyTables, 4);
        expect(result).toEqual([
            { code: "T3", seats: 4, tableId: 3 }
        ]);
    });
});

// SPLITTING SHOULD BE ALWAYS ON THE SMALLEST NUMBER OF TABLES
describe("allocateTables - Choosing fewer tables rather than a larger combination", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 4 },
        { tableId: 2, code: "T2", freeSeats: 4 },
        { tableId: 3, code: "T3", freeSeats: 4 },
        { tableId: 4, code: "T4", freeSeats: 6 },
        { tableId: 5, code: "T5", freeSeats: 7 },
    ];

    it("should prefer 2 tables (capacity 13) over 3 tables (capacity 12 exact) for party of 12", () => {
        const result = allocateTables(dummyTables, 12);
        expect(result).toEqual([
            { tableId: 4, code: "T4", seats: 6 },
            { tableId: 5, code: "T5", seats: 6 },
        ]);
    });
});

// MINIMIZE THE NUMBER OF UNUSED SEATS IF THE TABLE NUMBER IS THE SAME
describe("allocateTables - Choosing, for the same amount of tables, the combination that has less waste", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 4 },
        { tableId: 2, code: "T2", freeSeats: 2 },
        { tableId: 3, code: "T3", freeSeats: 4 },
    ];

    it("should prefer 2 tables (capacity 6) over 2 tables (capacity 8) for party of 5", () => {
        const result = allocateTables(dummyTables, 5);
        expect(result).toEqual([
            { tableId: 2, code: "T2", seats: 2 },
            { tableId: 1, code: "T1", seats: 3 },
        ]);
    });
});

// VERIFYING THE OUTPUT STRUCTURE
describe("allocateTables - The sum of assigned seats should be equal to partySize", () => {
    const dummyTables: FreeTable[] = [
        { tableId: 1, code: "T1", freeSeats: 4 },
        { tableId: 2, code: "T2", freeSeats: 4 },
    ];

    it("should return { ..., seats: 4} and { ..., seats: 1} for party of 5", () => {
        const result = allocateTables(dummyTables, 5);
        expect(result).toEqual([
            { tableId: 1, code: "T1", seats: 4 },
            { tableId: 2, code: "T2", seats: 1 },
        ]);
    });
});
