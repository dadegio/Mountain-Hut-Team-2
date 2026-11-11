const MAX_DESCRIPTION = 1000;

interface RequirementsFieldsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  textareaId?: string;
}

export default function RequirementsFields({
  enabled,
  onToggle,
  description,
  onDescriptionChange,
  textareaId = "description",
}: RequirementsFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="block text-xs font-semibold uppercase tracking-wider text-green-700">
        Allergies, intolerances &amp; notes
      </p>

      <label
        className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm cursor-pointer transition ${
          enabled
            ? "border-green-600 bg-green-50 text-green-900"
            : "border-stone-300 bg-white text-stone-700 hover:border-green-600"
        }`}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-green-600"
        />
        I have allergies, intolerances or special requests
      </label>

      {enabled && (
        <div>
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-xs font-medium text-stone-600"
          >
            Specify allergies, intolerances or notes
          </label>
          <textarea
            id={textareaId}
            rows={3}
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="e.g. peanut allergy, lactose intolerance, vegetarian, high chair"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 shadow-xs transition focus:outline-hidden focus:border-green-600 focus:ring-2 focus:ring-green-600/30"
          />
          <p className="mt-1 text-right text-xs text-stone-400">
            {description.length}/{MAX_DESCRIPTION}
          </p>
        </div>
      )}
    </div>
  );
}
