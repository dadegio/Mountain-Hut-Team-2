import type { Allergen } from "../types/booking";

const MAX_DESCRIPTION = 1000; 

interface RequirementsFieldsProps {
  allergens: Allergen[] | null; 
  loadError: boolean;
  selected: number[];
  onToggle: (allergenId: number) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}

export default function RequirementsFields({
  allergens,
  loadError,
  selected,
  onToggle,
  description,
  onDescriptionChange,
}: RequirementsFieldsProps) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wider text-green-700">
          Allergies & dietary needs
        </legend>

        {allergens === null && !loadError && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Loading allergens">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-stone-200 animate-pulse" />
            ))}
          </div>
        )}

        {loadError && (
          <p className="text-sm text-stone-500">
            The allergen list couldn't be loaded. Please describe any allergies below.
          </p>
        )}

        {allergens && allergens.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {allergens.map((a) => {
              const checked = selected.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                    checked
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-stone-300 bg-white text-stone-700 hover:border-green-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(a.id)}
                    className="h-4 w-4 accent-green-600"
                  />
                  {a.name}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-green-700"
        >
          Other requirements
        </label>
        <textarea
          id="description"
          rows={3}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g. one vegetarian, a high chair, celiac in the group"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 shadow-xs transition focus:outline-hidden focus:border-green-600 focus:ring-2 focus:ring-green-600/30"
        />
        <p className="mt-1 text-right text-xs text-stone-400">
          {description.length}/{MAX_DESCRIPTION}
        </p>
      </div>
    </div>
  );
}