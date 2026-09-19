"use client";

import { useEffect, useState } from "react";

import { FadeIn } from "@/components/FadeIn";
import { SummaryTable } from "@/components/SummaryTable";
import {
  cachedFetch,
  peekCached,
  postJson,
  SUMMARY_PAGE_SIZE,
  type SummaryResponse,
} from "@/lib/api";
import type { SummaryFilter } from "@/lib/navigation";

function unfilteredParams(page: number) {
  return { limit: SUMMARY_PAGE_SIZE, offset: page * SUMMARY_PAGE_SIZE };
}

export function FrequencySummary({
  filter,
  onClearFilter,
}: {
  filter: SummaryFilter | null;
  onClearFilter: () => void;
}) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // Held as a string so the field can be empty or mid-edit without the table
  // jumping on every keystroke. Committed on blur or Enter.
  const [pageInput, setPageInput] = useState("1");

  // New cohort filter starts at page 1.
  useEffect(() => {
    setPage(0);
    setPageInput("1");
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (filter) {
      // POST keeps hundreds of sample ids out of the URL. Same endpoint and
      // pagination as the unfiltered table.
      postJson<SummaryResponse>("/api/summary", {
        sample: filter.sampleIds,
        limit: SUMMARY_PAGE_SIZE,
        offset: page * SUMMARY_PAGE_SIZE,
      })
        .then((next) => {
          if (!cancelled) setData(next);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }

    const params = unfilteredParams(page);
    const cached = peekCached<SummaryResponse>("/api/summary", params);
    if (cached) {
      setData(cached);
    }

    cachedFetch<SummaryResponse>("/api/summary", params)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    void cachedFetch<SummaryResponse>("/api/summary", unfilteredParams(page + 1));
    if (page > 0) {
      void cachedFetch<SummaryResponse>("/api/summary", unfilteredParams(page - 1));
    }

    return () => {
      cancelled = true;
    };
  }, [page, filter]);

  // Five rows per sample, so total rows is samples * populations.
  const totalRows = data ? data.n_samples * data.populations.length : 0;
  const lastPage = Math.max(0, Math.ceil(totalRows / SUMMARY_PAGE_SIZE) - 1);

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
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        Population frequencies
      </p>
      <h2 className="mt-1 text-2xl font-bold text-[#0d0d0d]">
        Cell population frequencies
      </h2>
      <p className="mt-1 text-sm text-[#666]">
        Relative frequency of each immune cell population within each sample.
      </p>

      {filter && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#e5e0d9] bg-[#f9f6f2] px-3 py-2 text-sm">
          <span className="text-[#555]">
            Showing cohort:{" "}
            <span className="font-medium text-[#0d0d0d]">{filter.label}</span>
            {data && (
              <span className="text-[#999]">
                {" "}
                · {data.n_samples.toLocaleString()} samples
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded-lg border border-[#e5e0d9] bg-white px-2.5 py-1 text-xs font-medium text-[#333] transition-colors hover:border-[#ccc]"
          >
            Reset to full summary
          </button>
        </div>
      )}

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
        <FadeIn key={filter ? filter.label : "all"}>
          <div className="mt-6">
            <SummaryTable rows={data.rows} />
          </div>

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
