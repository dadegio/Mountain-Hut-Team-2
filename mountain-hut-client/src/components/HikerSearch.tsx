import { useEffect, useState } from "react";
import { searchHikers } from "../api/hikers";
import type { HikerMatch } from "../types/hiker";

interface HikerSearchProps {
  onSelect: (hiker: HikerMatch) => void;
}

interface SearchResult {
  term: string;
  hikers: HikerMatch[];
  error: string | null;
}

const MIN_LENGTH = 2;

export default function HikerSearch({ onSelect }: HikerSearchProps) {
  const [query, setQuery] = useState("");
  // Remembers which text the results belong to, as in the slots page
  const [result, setResult] = useState<SearchResult | null>(null);

  const term = query.trim();
  const longEnough = term.length >= MIN_LENGTH;

  useEffect(() => {
    if (term.length < MIN_LENGTH) return;
    let ignore = false;

    // Waits for a pause in the typing, not one request per letter
    const timer = setTimeout(() => {
      searchHikers(term)
        .then((hikers) => {
          if (!ignore) setResult({ term, hikers, error: null });
        })
        .catch((err: Error) => {
          if (!ignore) setResult({ term, hikers: [], error: err.message });
        });
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [term]);

  const current = result?.term === term ? result : null;

  return (
    <div className="space-y-3">
      <label className="flex flex-col text-sm">
        Name, phone or email
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 w-full border border-stone-300 rounded px-3 py-2 bg-white"
        />
      </label>

      {longEnough && !current && <p className="text-sm text-stone-500">Searching…</p>}
      {current?.error && <p className="text-sm text-red-600">Error: {current.error}</p>}
      {current && !current.error && current.hikers.length === 0 && (
        <p className="text-sm text-stone-500">No hiker found</p>
      )}

      {current && current.hikers.length > 0 && (
        <ul className="space-y-2">
          {current.hikers.map((hiker) => (
            <li key={hiker.id}>
              <button
                type="button"
                onClick={() => onSelect(hiker)}
                className="w-full text-left rounded-lg border-2 border-stone-200 bg-white p-3 hover:border-green-600"
              >
                <span className="block font-semibold">
                  {hiker.name} {hiker.surname}
                </span>
                <span className="block text-sm text-stone-600">
                  {hiker.email}
                  {hiker.phone_number && ` · ${hiker.phone_number}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
