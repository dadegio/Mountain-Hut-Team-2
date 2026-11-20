import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MealsPage from "../../../src/meals/pages/MealsPage.tsx";
import { getMeals } from "../../../src/meals/api/meals-api.ts";
import { getAllergens } from "../../../src/booking/api/allergens-api.ts";

vi.mock("../../../src/meals/api/meals-api.ts", () => ({ getMeals: vi.fn() }));
vi.mock("../../../src/booking/api/allergens-api.ts", () => ({ getAllergens: vi.fn() }));

const gluten = { id: 1, name: "Gluten" };

const alpino = {
  id: 1,
  name: "Menu Alpino",
  type: "TEMPLATE",
  allergens: [gluten],
  dishes: [{ id: 1, name: "Polenta", description: null, course: "MAIN", allergens: [gluten] }],
};
const leggero = {
  id: 2,
  name: "Menu Leggero",
  type: "TEMPLATE",
  allergens: [],
  dishes: [{ id: 2, name: "Insalata", description: null, course: "APPETIZER", allergens: [] }],
};

const meals = [
  { slotId: 1, date: "2026-11-20", from: "12:00", to: "14:00", menus: [alpino, leggero] },
  { slotId: 2, date: "2026-11-20", from: "19:00", to: "21:00", menus: [alpino] },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <MealsPage />
    </MemoryRouter>,
  );
}

describe("MealsPage – options that suit the party (MH-11)", () => {
  beforeEach(() => {
    vi.mocked(getMeals).mockResolvedValue(meals as never);
    vi.mocked(getAllergens).mockResolvedValue([gluten] as never);
  });

  it("shows no summary while no allergen is selected", async () => {
    renderPage();
    await screen.findAllByRole("article", { name: "Menu Alpino" });
    expect(screen.queryByText(/suits your party/i)).toBeNull();
    expect(screen.queryByText(/No menu suits/i)).toBeNull();
  });

  it("puts the suiting menu first and counts the suiting menus", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Gluten" }));

    const lunch = screen.getByRole("region", { name: "Meal 12:00–14:00" });
    const cards = within(lunch).getAllByRole("article");
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual(["Menu Leggero", "Menu Alpino"]);
    expect(within(lunch).getByText(/1 of 2 menus suit your party/)).toBeInTheDocument();
  });

  it("warns when no menu of a meal time suits the party", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Gluten" }));

    const dinner = screen.getByRole("region", { name: "Meal 19:00–21:00" });
    expect(within(dinner).getByText(/No menu suits your party/)).toBeInTheDocument();
  });
});