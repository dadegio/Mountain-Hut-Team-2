import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect } from "vitest";
import Navbar from "../../../src/shared/components/Navbar";
import { AuthContext, type AuthContextValue } from "../../../src/auth/context/auth-context.ts";
import type { User } from '../../../src/auth/types/auth.ts'

function renderNavbarAs(user: User | null) {
  const auth: AuthContextValue = {
    user,
    loading: false,
    login: async () => {
      throw new Error("not used");
    },
    logout: async () => {},
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const fakeUser = (type: User['type']): User => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test',
  surname: 'User',
  phoneNumber: '+390000000000',
  type,
})

describe("Navbar", () => {
  it("renders the brand name linking to home", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>,
    );
    const brand = screen.getByText("Mountain Hut");
    expect(brand).toBeInTheDocument();
    expect(brand.closest("a")).toHaveAttribute("href", "/");
  });

  it("shows Home, Book a table, Login and Register to guests", () => {
    renderNavbarAs(null);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Book a table")).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.queryByText("My bookings")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage slots")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /hut mail/i })).not.toBeInTheDocument();
  });

  it("shows booking links and Logout to hikers, but not Manage slots, Hut Mail, Login or Register", () => {
    renderNavbarAs(fakeUser("HIKER"));
    expect(screen.getByText("Book a table")).toBeInTheDocument();
    expect(screen.getByText("My bookings")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Manage slots")).not.toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
    expect(screen.queryByText("Register")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /hut mail/i })).not.toBeInTheDocument();
  });

  it("shows Manage slots and Hut Mail before the user name and Logout for employees", () => {
    renderNavbarAs(fakeUser("EMPLOYEE"));
    const manageSlots = screen.getByText("Manage slots");
    expect(manageSlots).toBeInTheDocument();
    expect(screen.getByText("New reservation")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Book a table")).not.toBeInTheDocument();
    expect(screen.queryByText("My bookings")).not.toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
    expect(screen.queryByText("Register")).not.toBeInTheDocument();

    const userName = screen.getByText("Test");
    const mailLink = screen.getByRole("link", { name: /hut mail/i });

    expect(mailLink).toHaveAttribute("target", "_blank");
    expect(mailLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(manageSlots.compareDocumentPosition(mailLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mailLink.compareDocumentPosition(userName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("highlights Home when on home route and inactive when on another page", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>,
    );
    const homeLink = screen.getByText("Home");
    expect(homeLink.className).toContain("text-green-700");
    expect(homeLink.className).toContain("font-semibold");

    const bookingLink = screen.getByText("Book a table");
    expect(bookingLink.className).not.toContain("font-semibold");

    unmount();

    // Test on another page
    render(
      <MemoryRouter initialEntries={["/booking"]}>
        <Navbar />
      </MemoryRouter>,
    );
    const homeLinkOnBooking = screen.getByText("Home");
    expect(homeLinkOnBooking.className).not.toContain("font-semibold");

    const bookingLinkActive = screen.getByText("Book a table");
    expect(bookingLinkActive.className).toContain("text-green-700");
    expect(bookingLinkActive.className).toContain("font-semibold");
  });

  it("toggles mobile menu when clicking the menu button", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>,
    );
    const toggleButton = screen.getByLabelText("Toggle navigation menu");
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");

    const homeLinks = screen.getAllByText("Home");
    expect(homeLinks.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
  });
});
