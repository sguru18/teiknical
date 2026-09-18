"use client";

import { useEffect, useState } from "react";

import { fetchJson, type SummaryResponse } from "@/lib/api";

const PAGE_SIZE = 50;

export default function Home() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // Held as a string so the field can be empty or mid-edit without the table
  // jumping on every keystroke. Committed on blur or Enter.
  const [pageInput, setPageInput] = useState("1");

  useEffect(() => {
    setError(null);
    fetchJson<SummaryResponse>("/api/summary", {
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
  // Keyed on sample rather than row index so it survives a sample having a
  // different number of populations.
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
    // Reject empty or non-numeric input by snapping back to the current page.
    goToPage(Number.isNaN(parsed) ? page : parsed - 1);
  }

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Cell population frequencies</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Relative frequency of each immune cell population within each sample.
      </p>

      {error && (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!data && !error && (
        <p className="mt-6 text-sm text-zinc-500">Loading…</p>
      )}

      {data && (
        <>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left">
                <th className="py-2 pr-4 font-medium">sample</th>
                <th className="py-2 pr-4 font-medium">total_count</th>
                <th className="py-2 pr-4 font-medium">population</th>
                <th className="py-2 pr-4 font-medium">count</th>
                <th className="py-2 font-medium">percentage</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={`${row.sample}-${row.population}`}
                  className={
                    shadedSamples.has(row.sample) ? "bg-zinc-100" : undefined
                  }
                >
                  <td className="py-1.5 pr-4 font-mono text-xs">
                    {row.sample}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {row.total_count.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-4">{row.population}</td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {row.percentage.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center gap-3 text-sm">
            <button
              className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
            >
              Previous
            </button>
            <span className="flex items-center gap-2 text-zinc-600">
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
                className="w-20 rounded border border-zinc-300 px-2 py-1 tabular-nums"
                aria-label="Page number"
              />
              <button
                // onMouseDown with preventDefault, because a plain onClick lands
                // after the input's onBlur has already committed and disabled
                // this button, so the click would be swallowed.
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitPageInput();
                }}
                disabled={pageInput === String(page + 1)}
                className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
                aria-label="Go to page"
              >
                ✓
              </button>
              of {lastPage + 1}
            </span>
            <button
              className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
              onClick={() => goToPage(page + 1)}
              disabled={page >= lastPage}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
