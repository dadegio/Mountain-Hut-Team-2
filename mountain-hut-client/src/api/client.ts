const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Builds a readable message from the backend's error body.
// Backend format: { error: string, details?: [{ message }] }
function errorMessage(status: number, raw: string): string {
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // not JSON (e.g. "Bad Gateway" from a proxy)
  }

  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    const { error, details } = body as { error: string; details?: unknown };
    const messages = Array.isArray(details)
      ? details
          .map((d: { message?: unknown }) => d?.message)
          .filter((m): m is string => typeof m === "string")
      : [];
    return messages.length > 0 ? `${error}: ${messages.join("; ")}` : error;
  }

  return `API error ${status}: ${raw}`;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    // read the body once as text, then try to parse it as JSON
    const raw = await res.text().catch(() => "");
    throw new ApiError(res.status, errorMessage(res.status, raw));
  }

  return res.json() as Promise<T>;
}