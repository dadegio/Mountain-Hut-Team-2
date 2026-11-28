// MH-183: phone numbers are unique per account, so every E2E hiker needs its own
let counter = 0;

export function uniquePhone(): string {
  counter += 1;
  const digits = `${Date.now() % 1_000_000}${counter}`.padStart(8, "0").slice(-8);
  return `+3933${digits}`;
}