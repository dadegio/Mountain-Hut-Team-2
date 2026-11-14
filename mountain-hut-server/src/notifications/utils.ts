export const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  dateStyle: "full",
});

export const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  timeStyle: "short",
});

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
