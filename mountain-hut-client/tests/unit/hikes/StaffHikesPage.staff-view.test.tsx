import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffHikesPage from "../../../src/hikes/pages/StaffHikesPage.tsx";
import { getRegisteredHikes } from "../../../src/hikes/api/hikes-api.ts";
import type { StaffHike } from "../../../src/hikes/types/hike.ts";

vi.mock("../../../src/hikes/api/hikes-api.ts", () => ({
  getRegisteredHikes: vi.fn(),
}));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Relative to now, so that the groups do not change as time goes by
function hike(id: number, startsIn: number, lasts: number, extra: Partial<StaffHike> = {}): StaffHike {
  const departure = Date.now() + startsIn;
  return {
    id,
    userId: id,
    departureAt: new Date(departure).toISOString(),
    expectedReturnAt: new Date(departure + lasts).toISOString(),
    routeDescription: `Route ${id}`,
    emergencyContactPhone: null,
    createdAt: "2030-06-01 10:00:00",
    hiker: { name: "Hiker", surname: String(id), phoneNumber: null },
    ...extra,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <StaffHikesPage />
    </MemoryRouter>,
  );
  return { user: userEvent.setup() };
}

describe("StaffHikesPage (staff view)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups the hikes, the most urgent first", async () => {
    // As the API returns them: sorted by expected return
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike(1, -5 * DAY, 6 * HOUR),
      hike(2, -6 * HOUR, 4 * HOUR),
      hike(3, -1 * HOUR, 4 * HOUR),
      hike(4, 1 * DAY, 5 * HOUR),
    ]);

    renderPage();

    const overdue = within(await screen.findByRole("region", { name: "Should be back" }));
    expect(overdue.getByText("Hiker 2")).toBeInTheDocument();
    expect(overdue.getByText(/· 2 h late$/)).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: "Out now" })).getByText("Hiker 3")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Upcoming" })).getByText("Hiker 4")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Earlier" })).getByText("Hiker 1")).toBeInTheDocument();

    const order = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));
    expect(order).toEqual(["Should be back", "Out now", "Upcoming", "Earlier"]);

    expect(screen.getByText(/1 should be back/)).toBeInTheDocument();
  });

  it("shows the phone numbers as call links", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike(1, 1 * DAY, 5 * HOUR, {
        emergencyContactPhone: "+39 333 999 0000",
        hiker: { name: "Mario", surname: "Rossi", phoneNumber: "+39 333 123 4567" },
      }),
    ]);

    renderPage();

    expect(await screen.findByRole("link", { name: "Hiker: +39 333 123 4567" })).toHaveAttribute(
      "href",
      "tel:+393331234567",
    );
    expect(screen.getByRole("link", { name: "Emergency contact: +39 333 999 0000" })).toHaveAttribute(
      "href",
      "tel:+393339990000",
    );
  });

  it("says so when the hiker has no phone", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([hike(1, 1 * DAY, 5 * HOUR)]);

    renderPage();

    expect(await screen.findByText("No hiker phone")).toBeInTheDocument();
  });

  it("hides the groups without hikes", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([hike(1, 1 * DAY, 5 * HOUR)]);

    renderPage();

    expect(await screen.findByRole("region", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Should be back" })).not.toBeInTheDocument();
  });

  it("says so when no hikes are registered", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No hikes registered yet.")).toBeInTheDocument();
  });

  it("shows the error when the hikes cannot be loaded", async () => {
    vi.mocked(getRegisteredHikes).mockRejectedValue(new Error("API error 500"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the hikes: API error 500");
  });

  it("loads the hikes again with Refresh", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([]);
    const { user } = renderPage();
    await screen.findByText("No hikes registered yet.");

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("No hikes registered yet.")).toBeInTheDocument();
    expect(getRegisteredHikes).toHaveBeenCalledTimes(2);
  });
});