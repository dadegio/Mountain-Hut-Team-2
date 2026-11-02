const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// The backend answers errors with { error, details? }: turn it into a readable message
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text);
    if (typeof body?.error === "string") {
      const details = Array.isArray(body.details)
        ? body.details.map((d: { message: string }) => d.message).join("; ")
        : "";
      return details ? `${body.error}: ${details}` : body.error;
    }
  } catch {
    // Not JSON: fall back to the raw text
  }
  return `API error ${res.status}: ${text}`;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }
  return res.json() as Promise<T>;
}
