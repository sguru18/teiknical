import type { SummaryRow } from "@/lib/api";

export function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  const shadedSamples = new Set(
    [...new Set(rows.map((row) => row.sample))].filter(
      (_, index) => index % 2 === 1,
    ),
  );

  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#e5e0d9] text-left">
          <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-[#999]">
            sample
          </th>
          <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-[#999]">
            total count
          </th>
          <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-[#999]">
            population
          </th>
          <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-[#999]">
            count
          </th>
          <th className="py-2 text-[10px] font-semibold uppercase tracking-widest text-[#999]">
            percentage
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.sample}-${row.population}`}
            className={
              shadedSamples.has(row.sample) ? "bg-[#f9f6f2]" : undefined
            }
          >
            <td className="py-1.5 pr-4 font-mono text-xs text-[#666]">
              {row.sample}
            </td>
            <td className="py-1.5 pr-4 tabular-nums text-[#333]">
              {row.total_count.toLocaleString()}
            </td>
            <td className="py-1.5 pr-4 text-[#333]">{row.population}</td>
            <td className="py-1.5 pr-4 tabular-nums text-[#333]">
              {row.count.toLocaleString()}
            </td>
            <td className="py-1.5 tabular-nums text-[#333]">
              {row.percentage.toFixed(2)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
