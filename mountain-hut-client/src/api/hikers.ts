import { ApiError, apiFetch } from "./client";
import type { UserType } from "../types/auth";
import type { HikerMatch } from "../types/hiker";

type UserMatch = HikerMatch & { type: UserType };

// The API matches whole values only, each in its own parameter, so what to ask
// depends on what was typed. "Mario Rossi" could also be typed "Rossi Mario"
function queriesFor(text: string): Record<string, string>[] {
  if (text.includes("@")) return [{ email: text }];
  if (/^\+?[\d\s]+$/.test(text)) return [{ phone_number: text.replace(/\s/g, "") }];

  const [first, ...others] = text.split(/\s+/);
  const rest = others.join(" ");
  return rest
    ? [
        { name: first, surname: rest },
        { name: rest, surname: first },
      ]
    : [{ name: first }, { surname: first }];
}

async function findUsers(query: Record<string, string>): Promise<UserMatch[]> {
  try {
    return await apiFetch<UserMatch[]>(`/v1/users?${new URLSearchParams(query)}`);
  } catch (err) {
    // The API answers 404 when nobody matches
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

export async function searchHikers(query: string): Promise<HikerMatch[]> {
  const results = await Promise.all(queriesFor(query.trim()).map(findUsers));
  // The same person can match more than one query
  const users = new Map(results.flat().map((user) => [user.id, user]));
  // Only hikers can have a booking
  return [...users.values()].filter((user) => user.type === "HIKER");
}
