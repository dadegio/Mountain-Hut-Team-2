import type { HikerMatch } from "../types/hiker";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hikers of the backend seed. Their ids match only on a newly created database
const mockHikers: HikerMatch[] = [
  {
    id: 1,
    name: "Mario",
    surname: "Rossi",
    email: "mario.rossi@example.com",
    phone_number: "+393331234567",
  },
  {
    id: 2,
    name: "Giulia",
    surname: "Verdi",
    email: "giulia.verdi@example.com",
    phone_number: "+393339876543",
  },
];

// TODO(MH-75): call the real search by name, phone or email once it exists
export async function searchHikers(query: string): Promise<HikerMatch[]> {
  await delay(300);
  const text = query.trim().toLowerCase();
  return mockHikers.filter((hiker) =>
    [`${hiker.name} ${hiker.surname}`, hiker.email, hiker.phone_number ?? ""].some((field) =>
      field.toLowerCase().includes(text),
    ),
  );
}
