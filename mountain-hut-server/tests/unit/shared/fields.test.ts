import { describe, expect, it } from "vitest";
import { emailField, nameField, phoneField, phoneFormat } from "#src/shared/fields";

describe("MH-183 shared fields", () => {
  describe("emailField", () => {
    it("lowercases and trims emails", () => {
      expect(emailField.parse("  Mario.Rossi@Example.com ")).toBe("mario.rossi@example.com");
    });

    it.each(["not-an-email", "", "   "])("rejects %s", (email) => {
      expect(emailField.safeParse(email).success).toBe(false);
    });
  });

  describe("nameField", () => {
    const name = nameField("Name");

    it("trims names", () => {
      expect(name.parse("  Anna  ")).toBe("Anna");
    });

    it.each(["", " ", "     "])("rejects a name made only of spaces (%j)", (value) => {
      expect(name.safeParse(value).success).toBe(false);
    });
  });

  it("phoneFormat keeps the number as typed", () => {
    expect(phoneFormat.parse(" +39 347 000 0000 ")).toBe("+39 347 000 0000");
    expect(phoneFormat.safeParse("abc").success).toBe(false);
  });

  describe("phoneField", () => {
    it.each([
      ["+39 333 123 4567", "+393331234567"],
      ["333-123-4567", "3331234567"],
      ["+39 (011) 123456", "+39011123456"],
    ])("accepts %s and stores it as %s", (input, stored) => {
      expect(phoneField.parse(input)).toBe(stored);
    });

    it.each(["abc", "12", "+39 abc 123", "++39333", "   "])("rejects %s", (value) => {
      expect(phoneField.safeParse(value).success).toBe(false);
    });
  });


});