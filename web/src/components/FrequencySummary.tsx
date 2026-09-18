"use client";

import { useEffect, useState } from "react";

import { FadeIn } from "@/components/FadeIn";
import { cachedFetch, type SummaryResponse } from "@/lib/api";

const PAGE_SIZE = 50;

export function FrequencySummary() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // Held as a string so the field can be empty or mid-edit without the table
  // jumping on every keystroke. Committed on blur or Enter.
  const [pageInput, setPageInput] = useState("1");

  useEffect(() => {
    setError(null);
    cachedFetch<SummaryResponse>("/api/summary", {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [page]);

  // Five rows per sample, so total rows is samples * populations.
  const totalRows = data ? data.n_samples * data.populations.length : 0;
  const lastPage = Math.max(0, Math.ceil(totalRows / PAGE_SIZE) - 1);

  // Shade alternate samples so the rows belonging to one sample read as a block.
  const shadedSamples = new Set(
    [...new Set(data?.rows.map((row) => row.sample))].filter(
      (_, index) => index % 2 === 1,
    ),
  );

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(next, 0), lastPage);
    setPage(clamped);
    setPageInput(String(clamped + 1));
  }

  function commitPageInput() {
    const parsed = Number.parseInt(pageInput, 10);
    goToPage(Number.isNaN(parsed) ? page : parsed - 1);
  }

  return (
    <div>
      {/* Teiko-style eyebrow + heading */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        Population frequencies
      </p>
      <h2 className="mt-1 text-2xl font-bold text-[#0d0d0d]">
        Cell population frequencies
      </h2>
      <p className="mt-1 text-sm text-[#666]">
        Relative frequency of each immune cell population within each sample.
      </p>

      {error && (
        <FadeIn>
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        </FadeIn>
      )}

      {!data && !error && (
        <p className="mt-6 text-sm text-[#999]">Loading…</p>
      )}

      {data && (
        <FadeIn key={`${data.rows[0]?.sample ?? "empty"}-${data.rows.at(-1)?.sample ?? ""}`}>
          <table className="mt-6 w-full border-collapse text-sm">
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
              {data.rows.map((row) => (
                <tr
                  key={`${row.sample}-${row.population}`}
                  className={
                    shadedSamples.has(row.sample)
                      ? "bg-[#f9f6f2]"
                      : undefined
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

          <div className="mt-4 flex items-center gap-3 text-sm">
            <button
              className="rounded-lg border border-[#e5e0d9] px-3 py-1.5 text-[#333] transition-colors hover:border-[#ccc] hover:bg-[#f9f6f2] disabled:opacity-40"
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
            >
              Previous
            </button>
            <span className="flex items-center gap-2 text-[#666]">
              Page
              <input
                type="number"
                min={1}
                max={lastPage + 1}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-20 rounded-lg border border-[#e5e0d9] px-2 py-1 tabular-nums focus:border-[#e5341a] focus:outline-none focus:ring-1 focus:ring-[#e5341a]"
                aria-label="Page number"
              />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitPageInput();
                }}
                disabled={pageInput === String(page + 1)}
                className="rounded-lg border border-[#e5e0d9] px-2 py-1 text-[#333] transition-colors hover:border-[#ccc] hover:bg-[#f9f6f2] disabled:opacity-40"
                aria-label="Go to page"
              >
                ✓
              </button>
              of {lastPage + 1}
            </span>
            <button
              className="rounded-lg border border-[#e5e0d9] px-3 py-1.5 text-[#333] transition-colors hover:border-[#ccc] hover:bg-[#f9f6f2] disabled:opacity-40"
              onClick={() => goToPage(page + 1)}
              disabled={page >= lastPage}
            >
              Next
            </button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
