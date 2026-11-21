import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

// These E2E tests require MH-106 (DELETE API) and MH-107 (Delete button).
// They use the seeded 19:00 slot for tomorrow, but fresh hikers for isolation.

function tomorrowDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

async function registerAndLoginHiker(page: Page) {
  const email = `e2e.cancel.${randomUUID()}@example.com`;
  const password = "Password123!";
  const phone = `+39333${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;

  const registration = await page.request.post("/api/v1/auth/register", {
    data: {
      email,
      password,
      name: "E2E",
      surname: "Cancellation",
      phoneNumber: phone,
      type: "HIKER",
    },
  });
  expect(registration.status()).toBe(201);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/booking$/);
}

async function createBookingThroughUI(page: Page, date: string) {
  // The seed creates tomorrow's dinner slot, with capacity for a party of two.
  const day = Number(date.slice(-2));
  if (day === 1) {
    await page.getByRole("button", { name: /next month/i }).click();
  }
  await page.locator(`[data-day="${date}"] button`).click();
  await page.getByRole("spinbutton", { name: "Party size" }).fill("2");
  await page.getByRole("button", { name: /19:00/ }).click();
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Booking confirmed" }),
  ).toBeVisible();

  // Read the real booking identifier; do not assume IDs or seed state.
  const response = await page.request.get("/api/v1/bookings/mine");
  expect(response.status()).toBe(200);
  const bookings = (await response.json()) as Array<{
    id: number;
    status: string;
  }>;
  expect(bookings).toHaveLength(1);
  expect(bookings[0].status).toBe("PLACED");
  return bookings[0].id;
}

async function seatsFree(page: Page, date: string): Promise<number> {
  const response = await page.request.get(
    `/api/v1/availability?date=${date}&partySize=2`,
  );
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    slots: Array<{ from: string; availableSeats: number }>;
  };
  const dinner = data.slots.find((slot) => slot.from === "19:00");
  expect(dinner, "The seeded 19:00 dinner slot must exist").toBeDefined();
  return dinner!.availableSeats;
}

test.describe("MH-08 / MH-110: Cancel a booking E2E", () => {
  test("hiker cancels via UI: history updates, state persists and seats return", async ({
    page,
  }) => {
    const date = tomorrowDate();
    const initialSeats = await seatsFree(page, date);

    await registerAndLoginHiker(page);
    const bookingId = await createBookingThroughUI(page, date);

    // A real booking has reduced the publicly visible slot capacity.
    expect(await seatsFree(page, date)).toBe(initialSeats - 2);

    await page
      .locator("section")
      .getByRole("link", { name: "My bookings", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "My bookings" }),
    ).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete", exact: true }),
    ).toBeVisible();

    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().endsWith(`/api/v1/bookings/${bookingId}`),
    );
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const cancelResponse = await cancelResponsePromise;

    expect(cancelResponse.status()).toBe(200);
    expect(await cancelResponse.json()).toMatchObject({
      id: bookingId,
      status: "CANCELED",
    });

    await expect(page.getByRole("status")).toHaveText(
      "Your booking has been cancelled.",
    );
    const history = page
      .getByRole("heading", { name: "Past & cancelled" })
      .locator("..");
    await expect(history.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByText("No upcoming bookings.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete", exact: true }),
    ).toHaveCount(0);

    // The cancellation survives a page reload and has changed persisted state.
    await page.reload();
    await expect(history.getByText("Cancelled", { exact: true })).toBeVisible();

    const mine = await page.request.get("/api/v1/bookings/mine");
    expect(mine.status()).toBe(200);
    const bookings = (await mine.json()) as Array<{
      id: number;
      status: string;
    }>;
    expect(bookings.find((booking) => booking.id === bookingId)?.status).toBe(
      "CANCELED",
    );

    // Cancelled reservations must no longer occupy seats.
    expect(await seatsFree(page, date)).toBe(initialSeats);
  });

  test("another hiker cannot view or cancel the first hiker booking", async ({
    page,
    browser,
  }) => {
    const date = tomorrowDate();
    await registerAndLoginHiker(page);
    const bookingId = await createBookingThroughUI(page, date);

    // A separate browser context has separate session cookies.
    const otherPage = await browser.newPage();
    try {
      await registerAndLoginHiker(otherPage);
      await otherPage.goto("/my-bookings");
      await expect(
        otherPage.getByText("You don't have any bookings yet."),
      ).toBeVisible();
      await expect(
        otherPage.getByRole("button", { name: "Delete" }),
      ).toHaveCount(0);

      const denied = await otherPage.request.delete(
        `/api/v1/bookings/${bookingId}`,
      );
      expect(denied.status()).toBe(404);

      const ownerBookings = await page.request.get("/api/v1/bookings/mine");
      expect(ownerBookings.status()).toBe(200);
      const bookings = (await ownerBookings.json()) as Array<{
        id: number;
        status: string;
      }>;
      expect(bookings.find((booking) => booking.id === bookingId)?.status).toBe(
        "PLACED",
      );
    } finally {
      await otherPage.close();
    }

    // Leave the shared test database's seats free for following tests.
    const cleanup = await page.request.delete(`/api/v1/bookings/${bookingId}`);
    expect(cleanup.status()).toBe(200);
  });

  test("guest must log in and cannot call the cancellation API", async ({
    page,
  }) => {
    await page.goto("/my-bookings");
    await expect(page).toHaveURL(/\/login/);

    const response = await page.request.delete("/api/v1/bookings/1");
    expect(response.status()).toBe(401);
  });
});
