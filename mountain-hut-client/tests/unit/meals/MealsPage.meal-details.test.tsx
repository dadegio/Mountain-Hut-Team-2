import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MealsPage from "../../../src/meals/pages/MealsPage.tsx";
import { getMeals } from "../../../src/meals/api/meals-api.ts";
import { getAllergens } from "../../../src/booking/api/allergens-api.ts";
import { todayString } from "../../../src/shared/utils/date.ts";
import { addDays } from "../../../src/meals/utils/meal-rules.ts";
import type { MealTime } from "../../../src/meals/types/meal.ts";

vi.mock("../../../src/meals/api/meals-api.ts", () => ({ getMeals: vi.fn() }));
vi.mock("../../../src/booking/api/allergens-api.ts", () => ({ getAllergens: vi.fn() }));

const MILK = { id: 1, name: "Milk" };
const EGGS = { id: 2, name: "Eggs" };
const WHEAT = { id: 6, name: "Wheat" };

function meals(date: string): MealTime[] {
  return [
    {
      slotId: 1,
      date,
      from: "12:00",
      to: "14:00",
      menus: [
        {
          id: 1,
          name: "Menu Alpino",
          type: "TEMPLATE",
          allergens: [MILK, WHEAT],
          dishes: [
            {
              id: 1,
              name: "Tagliere",
              description: "Cold cuts and cheese",
              course: "APPETIZER",
              allergens: [MILK, WHEAT],
            },
            { id: 2, name: "Patate", description: null, course: "SIDE", allergens: [] },
          ],
        },
        {
          id: 2,
          name: "Menu Leggero",
          type: "TEMPLATE",
          allergens: [],
          dishes: [{ id: 3, name: "Insalata", description: null, course: "MAIN", allergens: [] }],
        },
      ],
    },
    { slotId: 2, date, from: "19:00", to: "21:00", menus: [] },
  ];
}

function renderPage() {
  render(
    <MemoryRouter>
      <MealsPage />
    </MemoryRouter>,
  );
  return { user: userEvent.setup() };
}

const lunch = () => screen.findByRole("region", { name: "Meal 12:00–14:00" });

describe("MealsPage (MH-134)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMeals).mockImplementation(async (date) => meals(date));
    vi.mocked(getAllergens).mockResolvedValue([MILK, EGGS, WHEAT]);
  });

  it("shows today's meal times with their menus and dishes by course", async () => {
    renderPage();

    const meal = within(await lunch());
    expect(getMeals).toHaveBeenCalledWith(todayString());

    const alpino = within(meal.getByRole("article", { name: "Menu Alpino" }));
    expect(alpino.getByText("Appetizers")).toBeInTheDocument();
    expect(alpino.getByText("Tagliere")).toBeInTheDocument();
    expect(alpino.getByText("Cold cuts and cheese")).toBeInTheDocument();
    expect(alpino.getByText("Sides")).toBeInTheDocument();
    expect(alpino.getByText("Allergens:").parentElement).toHaveTextContent("Allergens: Milk, Wheat");
    const leggero = within(meal.getByRole("article", { name: "Menu Leggero" }));
    expect(leggero.getByText("No listed allergens")).toBeInTheDocument();
  });

  it("says when the menu of a meal time is not announced yet", async () => {
    renderPage();

    const dinner = within(await screen.findByRole("region", { name: "Meal 19:00–21:00" }));
    expect(dinner.getByText("The menu for this meal time hasn't been announced yet.")).toBeInTheDocument();
  });

  it("says when a day has no meal times", async () => {
    vi.mocked(getMeals).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No meal times on this day.")).toBeInTheDocument();
  });

  it("loads the meals of another day", async () => {
    const { user } = renderPage();
    await lunch();

    await user.click(screen.getByRole("button", { name: "Tomorrow" }));

    expect(getMeals).toHaveBeenLastCalledWith(addDays(todayString(), 1));
    expect(screen.getByRole("button", { name: "Tomorrow" })).toHaveAttribute("aria-pressed", "true");
    expect(await lunch()).toBeInTheDocument();
  });

  it("marks which menus suit the party", async () => {
    const { user } = renderPage();
    const meal = within(await lunch());
    expect(screen.queryByText("✓ Suits your party")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Milk" }));

    expect(
      within(meal.getByRole("article", { name: "Menu Alpino" })).getByText("Contains Milk"),
    ).toBeInTheDocument();
    expect(
      within(meal.getByRole("article", { name: "Menu Leggero" })).getByText("✓ Suits your party"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("Contains Milk")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Suits your party")).not.toBeInTheDocument();
  });

  it("shows the error when the meals cannot be loaded", async () => {
    vi.mocked(getMeals).mockRejectedValue(new Error("API error 500"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the meals: API error 500");
  });

  it("still shows the meals when the allergen list cannot be loaded", async () => {
    vi.mocked(getAllergens).mockRejectedValue(new Error("down"));
    renderPage();

    expect(await screen.findByText(/allergen list couldn't be loaded/)).toBeInTheDocument();
    expect(await lunch()).toBeInTheDocument();
  });

  it("rejects a typed past date and keeps the current day", async () => {
    renderPage();
    await waitFor(() => expect(getMeals).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Other day"), { target: { value: "2020-05-01" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Pick today or a later day");
    expect(getMeals).not.toHaveBeenCalledWith("2020-05-01");
  });
});