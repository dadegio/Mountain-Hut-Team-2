import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterHikePage from "../../../src/hikes/pages/RegisterHikePage.tsx";
import { registerHike } from "../../../src/hikes/api/hikes-api.ts";
import { addHours, localInputToIso } from "../../../src/hikes/utils/hike-time.ts";
import { SUGGESTED_ROUTES } from "../../../src/hikes/utils/suggested-routes.ts";
import { ApiError } from "../../../src/shared/api/client.ts";

// Only the call to the backend is replaced: the page logic is the real one
vi.mock("../../../src/hikes/api/hikes-api.ts", () => ({
  registerHike: vi.fn(),
}));

const [LAKE, RIDGE] = SUGGESTED_ROUTES;

function savedHike() {
  return {
    id: 7,
    userId: 1,
    departureAt: "2030-06-15T06:00:00.000Z",
    expectedReturnAt: "2030-06-15T09:00:00.000Z",
    routeDescription: LAKE.description,
    emergencyContactPhone: null,
    createdAt: "2030-06-01 10:00:00",
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <RegisterHikePage />
    </MemoryRouter>,
  );
  return { user: userEvent.setup() };
}

const routeField = () => screen.getByLabelText("Route details") as HTMLTextAreaElement;
const departureField = () => screen.getByLabelText("Departure") as HTMLInputElement;
const returnField = () => screen.getByLabelText("Expected return") as HTMLInputElement;
const phoneField = () => screen.getByLabelText(/Emergency contact/) as HTMLInputElement;
const routeCard = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const backIn = (label: string) => screen.getByRole("button", { name: label });
const registerButton = () => screen.getByRole("button", { name: "Register hike" });

describe("RegisterHikePage (MH-140)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("starting values", () => {
    it("suggests the next full hour as departure and leaves the rest empty", () => {
      renderPage();

      expect(departureField().value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
      expect(Date.parse(departureField().value)).toBeGreaterThan(Date.now());
      expect(returnField()).toHaveValue("");
      expect(routeField()).toHaveValue("");
    });
  });

  describe("suggested routes", () => {
    it("fills in the description and the return of the chosen route", async () => {
      const { user } = renderPage();
      const departure = departureField().value;

      await user.click(routeCard(LAKE.name));

      expect(routeCard(LAKE.name)).toHaveAttribute("aria-pressed", "true");
      expect(routeField()).toHaveValue(LAKE.description);
      expect(returnField()).toHaveValue(addHours(departure, LAKE.hours));
      expect(backIn("3 h")).toHaveAttribute("aria-pressed", "true");
    });

    it("moves the return when the departure changes", async () => {
      const { user } = renderPage();
      await user.click(routeCard(RIDGE.name));

      fireEvent.change(departureField(), { target: { value: "2031-01-10T06:00" } });

      expect(returnField()).toHaveValue("2031-01-10T11:00");
    });

    it("clears a suggested description when switching to my own route", async () => {
      const { user } = renderPage();
      await user.click(routeCard(LAKE.name));

      await user.click(routeCard("My own route"));

      expect(routeField()).toHaveValue("");
      expect(routeCard(LAKE.name)).toHaveAttribute("aria-pressed", "false");
    });

    it("keeps what the hiker typed when choosing my own route", async () => {
      const { user } = renderPage();
      await user.type(routeField(), "Up to the old bivouac");

      await user.click(routeCard("My own route"));

      expect(routeField()).toHaveValue("Up to the old bivouac");
    });
  });

  describe("expected return", () => {
    it("sets the return with a Back in button", async () => {
      const { user } = renderPage();
      const departure = departureField().value;

      await user.click(backIn("8 h"));

      expect(returnField()).toHaveValue(addHours(departure, 8));
      expect(screen.getByText(/out for 8 h/)).toBeInTheDocument();
    });

    it("warns when the return is before the departure", () => {
      renderPage();

      fireEvent.change(returnField(), {
        target: { value: addHours(departureField().value, -1) },
      });

      expect(
        screen.getByText("The expected return must be after the departure."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/out for/)).not.toBeInTheDocument();
    });
  });

  describe("registering", () => {
    it("sends the hike and confirms it, then resets the form", async () => {
      vi.mocked(registerHike).mockResolvedValue(savedHike());
      const { user } = renderPage();
      const departure = departureField().value;

      await user.click(routeCard(LAKE.name));
      await user.type(phoneField(), "+39 333 123 4567");
      await user.click(registerButton());

      expect(registerHike).toHaveBeenCalledWith({
        departureAt: localInputToIso(departure),
        expectedReturnAt: localInputToIso(addHours(departure, LAKE.hours)),
        routeDescription: LAKE.description,
        emergencyContactPhone: "+39 333 123 4567",
      });
      expect(await screen.findByRole("status")).toHaveTextContent("Hike registered.");
      expect(screen.getByRole("link", { name: "See my hikes" })).toHaveAttribute(
        "href",
        "/my-hikes",
      );
      expect(routeField()).toHaveValue("");
      expect(returnField()).toHaveValue("");
      expect(phoneField()).toHaveValue("");
    });

    it("leaves out the contact when it is empty", async () => {
      vi.mocked(registerHike).mockResolvedValue(savedHike());
      const { user } = renderPage();

      await user.click(routeCard(LAKE.name));
      await user.click(registerButton());

      expect(registerHike).toHaveBeenCalledTimes(1);
      expect(vi.mocked(registerHike).mock.calls[0][0]).not.toHaveProperty(
        "emergencyContactPhone",
      );
    });

    it.each([
      ["no route", async () => {}, "Describe your route."],
      [
        "no return time",
        async (user: ReturnType<typeof userEvent.setup>) => {
          await user.type(routeField(), "Lake loop");
        },
        "Choose when you expect to be back.",
      ],
    ])("does not call the backend with %s", async (_name, fill, message) => {
      const { user } = renderPage();

      await fill(user);
      await user.click(registerButton());

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(registerHike).not.toHaveBeenCalled();
    });

    it("does not call the backend when the return is before the departure", async () => {
      const { user } = renderPage();
      await user.type(routeField(), "Lake loop");
      fireEvent.change(returnField(), {
        target: { value: addHours(departureField().value, -1) },
      });

      await user.click(registerButton());

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Expected return must be after departure.",
      );
      expect(registerHike).not.toHaveBeenCalled();
    });

    it.each([
      [new ApiError(400, "Departure must be in the future"), "Departure must be in the future"],
      [new ApiError(403, "Insufficient permissions"), "Only hikers can register a hike."],
      [new ApiError(401, "Authentication required"), "Please log in to register a hike."],
      [new Error("network down"), "Something went wrong. Please try again."],
    ])("shows the error and keeps what was entered (%s)", async (error, message) => {
      vi.mocked(registerHike).mockRejectedValue(error);
      const { user } = renderPage();

      await user.click(routeCard(LAKE.name));
      await user.click(registerButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(routeField()).toHaveValue(LAKE.description);
    });
  });
});