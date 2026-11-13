import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CopyWeekForm from "../../../src/slots/components/CopyWeekForm.tsx";
import { mondayOf } from "../../../src/slots/utils/week-date.ts";
import { copyWeek } from "../../../src/slots/api/slots-api.ts";

vi.mock("../../../src/slots/api/slots-api.ts", () => ({ copyWeek: vi.fn() }));

const SOURCE = "2099-01-15"; // Thursday

afterEach(() => { vi.clearAllMocks(); });

describe("MH-129 weekly schedule copy", () => {
  it("normalizes an arbitrary selected day to its Monday", () => {
    expect(mondayOf("2099-01-15")).toBe("2099-01-12");
    expect(mondayOf("2099-01-18")).toBe("2099-01-12");
    expect(mondayOf("2099-01-19")).toBe("2099-01-19");
  });

  it("submits the MH-125 API contract and navigates to destination", async () => {
    vi.mocked(copyWeek).mockResolvedValue({
      sourceWeekStart: "2099-01-12", targetWeekStart: "2099-01-19", weeks: 1, copiedSlots: 2,
    });
    const onCopied = vi.fn();
    render(<CopyWeekForm selectedDate={SOURCE} onCopied={onCopied} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Copy week" }));
    expect(copyWeek).toHaveBeenCalledWith({
      sourceWeekStart: "2099-01-12", targetWeekStart: "2099-01-19", weeks: 1,
    });
    expect(onCopied).toHaveBeenCalledWith("2099-01-19", 2, 1);
  });

  it("refuses an overlapping destination week before the request", async () => {
    render(<CopyWeekForm selectedDate={SOURCE} onCopied={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("First destination week"), { target: { value: "2099-01-15" } });
    expect(screen.getByRole("button", { name: "Copy week" })).toBeDisabled();
    expect(copyWeek).not.toHaveBeenCalled();
  });

  it("does not crash when the number of weeks is cleared", () => {
    render(<CopyWeekForm selectedDate={SOURCE} onCopied={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Number of weeks"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Copy week" })).toBeDisabled();
    expect(copyWeek).not.toHaveBeenCalled();
  });

  it("shows backend conflicts instead of claiming success", async () => {
    vi.mocked(copyWeek).mockRejectedValue(new Error("Destination slot overlaps"));
    const onCopied = vi.fn();
    render(<CopyWeekForm selectedDate={SOURCE} onCopied={onCopied} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Copy week" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Destination slot overlaps");
    expect(onCopied).not.toHaveBeenCalled();
  });
});
