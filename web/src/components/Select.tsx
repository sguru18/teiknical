"use client";

export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[] | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      {/* Teiko-style ALL CAPS label in red, like "CELLULAR METRICS" / "TYPE OF ASSAY" */}
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!options || disabled}
        // Fixed width: a select sizes to its widest option, so it would jump
        // when the fetched options replace the single placeholder.
        className="w-44 rounded-lg border border-[#e5e0d9] bg-white px-2 py-1.5 text-sm text-[#0d0d0d] shadow-sm transition-colors focus:border-[#e5341a] focus:outline-none focus:ring-1 focus:ring-[#e5341a] disabled:cursor-not-allowed disabled:bg-[#f0ebe4] disabled:text-[#999]"
      >
        {(options ?? [value]).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
