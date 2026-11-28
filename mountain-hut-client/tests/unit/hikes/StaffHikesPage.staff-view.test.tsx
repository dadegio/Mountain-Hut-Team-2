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
const at = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR).toISOString();

let nextId = 1;
function hike(overrides: Partial<StaffHike> & { from: number; to: number }): StaffHike {
  const { from, to, ...rest } = overrides;
  return {
    id: nextId++,
    userId: 1,
    departureAt: at(from),
    expectedReturnAt: at(to),
    destination: "Rifugio Quintino Sella",
    routeDescription: "Via the Chiaretto lake",
    intermediatePoints: ["Lago Chiaretto", "Viso Mozzo"],
    emergencyContactPhone: null,
    completedAt: null,
    createdAt: at(-100),
    hiker: { name: "Giulia", surname: "Verdi", phoneNumber: "+39 333 987 6543" },
    ...rest,
  };
}

function renderPage() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <StaffHikesPage />
    </MemoryRouter>,
  );
  return { user };
}

const panel = (name: string) => screen.getByRole("region", { name });

describe("StaffHikesPage (MH-21 staff view)", () => {
  beforeEach(() => {
    nextId = 1;
    vi.mocked(getRegisteredHikes).mockReset();
  });

  it("puts each hike in the right panel: on a hike now, upcoming or past", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike({ from: -1, to: 2, destination: "Out Lake" }),
      hike({ from: 2, to: 5, destination: "Later Summit" }),
      hike({ from: -72, to: -66, completedAt: at(-66), destination: "Old Glacier" }),
    ]);
    renderPage();

    expect(await screen.findByText("→ Out Lake")).toBeInTheDocument();
    expect(within(panel("On a hike now")).getByText("→ Out Lake")).toBeInTheDocument();
    expect(within(panel("Upcoming")).getByText("→ Later Summit")).toBeInTheDocument();
    expect(within(panel("Past")).getByText("→ Old Glacier")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "On a hike now (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Past (1)" })).toBeInTheDocument();
  });

  it("keeps overdue hikes on 'On a hike now' until they are completed", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike({ from: -8, to: -2, destination: "Overdue Pass" }),
    ]);
    renderPage();

    expect(await screen.findByText("→ Overdue Pass")).toBeInTheDocument();
    expect(within(panel("On a hike now")).getByText("→ Overdue Pass")).toBeInTheDocument();
  });

  it("moves a completed hike to Past, even if it was expected back later", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike({ from: -2, to: 3, completedAt: at(-1), destination: "Early Return" }),
    ]);
    renderPage();

    expect(await screen.findByText("→ Early Return")).toBeInTheDocument();
    const past = within(panel("Past"));
    expect(past.getByText("→ Early Return")).toBeInTheDocument();
    expect(past.getByText("Back")).toBeInTheDocument();
    expect(within(panel("On a hike now")).queryByText("→ Early Return")).toBeNull();
  });

  it("shows the hiker, destination, route and passage points of a hike", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([hike({ from: -1, to: 2 })]);
    renderPage();

    const active = within(await screen.findByRole("list", { name: "Hikers on a hike now" }));
    expect(active.getByText("Giulia Verdi")).toBeInTheDocument();
    expect(active.getByText("→ Rifugio Quintino Sella")).toBeInTheDocument();
    expect(active.getByText("Via the Chiaretto lake")).toBeInTheDocument();
    expect(active.getByText("Lago Chiaretto → Viso Mozzo")).toBeInTheDocument();
    expect(active.getByText("Left")).toBeInTheDocument();
    expect(active.getByText("Expected back")).toBeInTheDocument();
    expect(active.queryByText("Back")).toBeNull();
  });

  it("hides the passage points row when there are none", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([hike({ from: -1, to: 2, intermediatePoints: [] })]);
    renderPage();

    await screen.findByText("→ Rifugio Quintino Sella");
    expect(screen.queryByText("Passage points")).toBeNull();
  });

  it("orders each panel: back soonest, leaving soonest, most recently back first", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike({ from: -2, to: 5, destination: "Active late" }),
      hike({ from: -1, to: 1, destination: "Active soon" }),
      hike({ from: 6, to: 9, destination: "Upcoming late" }),
      hike({ from: 2, to: 4, destination: "Upcoming soon" }),
      hike({ from: -120, to: -115, completedAt: at(-115), destination: "Past old" }),
      hike({ from: -72, to: -66, completedAt: at(-66), destination: "Past recent" }),
    ]);
    renderPage();
    await screen.findByText("→ Active soon");

    const order = (list: string) =>
      within(screen.getByRole("list", { name: list }))
        .getAllByText(/^→ /)
        .map((el) => el.textContent);

    expect(order("Hikers on a hike now")).toEqual(["→ Active soon", "→ Active late"]);
    expect(order("Upcoming hikes")).toEqual(["→ Upcoming soon", "→ Upcoming late"]);
    expect(order("Past hikes")).toEqual(["→ Past recent", "→ Past old"]);
  });

  it("shows the phone numbers as call links", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike({ from: -1, to: 2, emergencyContactPhone: "+39 333 765 4321" }),
    ]);
    renderPage();

    expect(await screen.findByRole("link", { name: "Hiker: +39 333 987 6543" })).toHaveAttribute(
      "href",
      "tel:+393339876543",
    );
    expect(screen.getByRole("link", { name: "Emergency contact: +39 333 765 4321" })).toHaveAttribute(
      "href",
      "tel:+393337654321",
    );
  });

  it("says so when the hiker has no phone", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([
      hike({ from: -1, to: 2, hiker: { name: "Luca", surname: "Neri", phoneNumber: null } }),
    ]);
    renderPage();

    expect(await screen.findByText("No hiker phone")).toBeInTheDocument();
  });

  it("shows an empty message in every panel when there are no hikes", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nobody is out on a hike right now")).toBeInTheDocument();
    expect(screen.getByText("No upcoming hikes")).toBeInTheDocument();
    expect(screen.getByText("No past hikes")).toBeInTheDocument();
  });

  it("loads the hikes again with Refresh", async () => {
    vi.mocked(getRegisteredHikes).mockResolvedValueOnce([]);
    vi.mocked(getRegisteredHikes).mockResolvedValueOnce([hike({ from: -1, to: 2 })]);
    const { user } = renderPage();
    await screen.findByText("Nobody is out on a hike right now");

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("→ Rifugio Quintino Sella")).toBeInTheDocument();
    expect(getRegisteredHikes).toHaveBeenCalledTimes(2);
  });

  it("shows the error and loads again with Retry", async () => {
    vi.mocked(getRegisteredHikes).mockRejectedValueOnce(new Error("Server down"));
    vi.mocked(getRegisteredHikes).mockResolvedValueOnce([]);
    const { user } = renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the hikes: Server down");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Nobody is out on a hike right now")).toBeInTheDocument();
  });
});