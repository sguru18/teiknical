"use client";

import { useEffect, useState } from "react";

import { fetchJson, type SummaryResponse } from "@/lib/api";

const PAGE_SIZE = 50;

export default function Home() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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

      {!data && !error && <p className="mt-6 text-sm text-zinc-500">Loading…</p>}

      {data && (
        <>
          <p className="mt-6 text-sm text-zinc-600">
            {data.n_samples.toLocaleString()} samples ×{" "}
            {data.populations.length} populations ={" "}
            {totalRows.toLocaleString()} rows
          </p>

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
                  className="border-b border-zinc-100"
                >
                  <td className="py-1.5 pr-4 font-mono text-xs">{row.sample}</td>
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
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span className="text-zinc-600">
              Page {page + 1} of {lastPage + 1}
            </span>
            <button
              className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
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
