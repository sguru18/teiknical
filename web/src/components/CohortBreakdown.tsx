"use client";

import { useEffect, useState } from "react";

import { FadeIn } from "@/components/FadeIn";
import { Select } from "@/components/Select";
import {
  cachedFetch,
  DEFAULT_COHORT_PARAMS,
  peekCached,
  type CategoryCount,
  type CohortResponse,
  type CrossTabRow,
  type FilterOptions,
} from "@/lib/api";
import type { ComparePreset, SummaryFilter } from "@/lib/navigation";

function Breakdown({
  title,
  unit,
  counts,
}: {
  title: string;
  unit: string;
  counts: CategoryCount[];
}) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex-1 min-w-[180px] rounded-xl border border-[#e5e0d9] bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        {unit}
      </p>
      <h3 className="mt-0.5 font-semibold text-[#0d0d0d]">{title}</h3>
      <p className="mt-0.5 text-xs text-[#999]">
        {total.toLocaleString()} total
      </p>
      <ul className="mt-4 space-y-3">
        {counts.map((c) => (
          <li key={c.label}>
            <div className="flex justify-between text-sm">
              <span className="text-[#333]">{c.label}</span>
              <span className="tabular-nums text-[#555]">
                {c.count.toLocaleString()}
                {total > 0 && (
                  <span className="ml-2 text-xs text-[#999]">
                    {((100 * c.count) / total).toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full rounded-full bg-[#f0ebe4]">
              <div
                className="h-1 rounded-full bg-[#e5341a]"
                style={{ width: total > 0 ? `${(100 * c.count) / total}%` : 0 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CrossTabTable({
  title,
  rows,
  groupKey,
  onViewChart,
}: {
  title: string;
  rows: CrossTabRow[];
  groupKey: "sex" | "proj_id";
  onViewChart: (filter: { sex?: string; proj_id?: string }) => void;
}) {
  const cols = ["Responders", "Non-resp.", "Not rec.", "Total"];
  return (
    <div className="flex-1 min-w-[280px] rounded-xl border border-[#e5e0d9] bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        subjects
      </p>
      <h3 className="mt-0.5 font-semibold text-[#0d0d0d]">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e5e0d9] text-left">
              <th className="py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-[#999]">
                Group
              </th>
              {cols.map((c) => (
                <th
                  key={c}
                  className="py-1.5 pr-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[#999]"
                >
                  {c}
                </th>
              ))}
              <th className="py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#999]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const respPct =
                row.total > 0
                  ? ((100 * row.responders) / row.total).toFixed(1)
                  : "—";
              return (
                <tr key={row.label} className="border-b border-[#f0ebe4] last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-[#333]">{row.label}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#333]">
                    {row.responders.toLocaleString()}
                    <span className="ml-1 text-xs text-[#999]">({respPct}%)</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#555]">
                    {row.non_responders.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#999]">
                    {row.not_recorded > 0 ? row.not_recorded.toLocaleString() : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-medium text-[#333]">
                    {row.total.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => onViewChart({ [groupKey]: row.label })}
                      className="rounded-lg border border-[#e5e0d9] px-2 py-0.5 text-xs text-[#555] transition-colors hover:border-[#ccc] hover:text-[#0d0d0d]"
                    >
                      Chart →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cohortLabel(
  condition: string,
  treatment: string,
  sampleType: string,
  timepoint: string,
) {
  return `${condition} · ${treatment} · ${sampleType} · day ${timepoint}`;
}

export function CohortBreakdown({
  onViewFrequencies,
  onViewChart,
}: {
  onViewFrequencies: (filter: SummaryFilter) => void;
  onViewChart: (preset: ComparePreset) => void;
}) {
  const [condition, setCondition] = useState<string>(
    DEFAULT_COHORT_PARAMS.condition,
  );
  const [treatment, setTreatment] = useState<string>(
    DEFAULT_COHORT_PARAMS.treatment,
  );
  const [sampleType, setSampleType] = useState<string>(
    DEFAULT_COHORT_PARAMS.sample_type,
  );
  const [timepoint, setTimepoint] = useState<string>(
    String(DEFAULT_COHORT_PARAMS.time_from_treatment_start),
  );

  const [options, setOptions] = useState<FilterOptions | null>(
    () => peekCached("/api/filters") ?? null,
  );
  const [data, setData] = useState<CohortResponse | null>(
    () => peekCached("/api/cohort", DEFAULT_COHORT_PARAMS) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => data === null);

  useEffect(() => {
    cachedFetch<FilterOptions>("/api/filters").then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {
      condition,
      treatment,
      sample_type: sampleType,
      time_from_treatment_start: Number(timepoint),
    };
    const cached = peekCached<CohortResponse>("/api/cohort", params);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setLoading(true);

    cachedFetch<CohortResponse>("/api/cohort", params)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [condition, treatment, sampleType, timepoint]);

  const label = cohortLabel(condition, treatment, sampleType, timepoint);
  const canNavigate = Boolean(data && data.n_samples > 0);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        Cohort breakdown
      </p>
      <h2 className="mt-1 text-2xl font-bold text-[#0d0d0d]">
        Sample composition
      </h2>
      <p className="mt-1 text-sm text-[#666]">
        Samples matching a single treatment arm at one timepoint, broken down by
        project, response and sex.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-6">
        <Select
          label="Condition"
          value={condition}
          options={options?.conditions}
          onChange={setCondition}
        />
        <Select
          label="Treatment"
          value={treatment}
          options={options?.treatments}
          onChange={setTreatment}
        />
        <Select
          label="Sample type"
          value={sampleType}
          options={options?.sample_types}
          onChange={setSampleType}
        />
        <Select
          label="Days from treatment"
          value={timepoint}
          options={options?.timepoints.map(String)}
          onChange={setTimepoint}
        />
      </div>

      {error && (
        <FadeIn>
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        </FadeIn>
      )}

      {!data && !error && <p className="mt-6 text-sm text-[#999]">Loading…</p>}

      {data && (
        <FadeIn
          key={`${data.n_samples}-${data.n_subjects}-${data.sample_ids[0] ?? "none"}`}
          className={
            loading ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          <div className="mt-6 flex gap-4">
            <div className="rounded-xl border border-[#e5e0d9] bg-white px-5 py-4">
              <p className="text-2xl font-bold text-[#0d0d0d]">
                {data.n_samples.toLocaleString()}
              </p>
              <p className="text-xs text-[#999]">Samples</p>
            </div>
            <div className="rounded-xl border border-[#e5e0d9] bg-white px-5 py-4">
              <p className="text-2xl font-bold text-[#0d0d0d]">
                {data.n_subjects.toLocaleString()}
              </p>
              <p className="text-xs text-[#999]">Subjects</p>
            </div>
          </div>

          {data.n_samples === 0 ? (
            <p className="mt-4 rounded-lg border border-[#e5e0d9] bg-white p-3 text-sm text-[#555]">
              No samples match this combination.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-4">
                <Breakdown
                  title="Subjects by response"
                  unit="subjects"
                  counts={data.subjects_by_response}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <CrossTabTable
                  title="Response by sex"
                  rows={data.response_by_sex}
                  groupKey="sex"
                  onViewChart={(filter) =>
                    onViewChart({
                      condition,
                      treatment,
                      sample_type: sampleType,
                      ...filter,
                    })
                  }
                />
                <CrossTabTable
                  title="Response by project"
                  rows={data.response_by_project}
                  groupKey="proj_id"
                  onViewChart={(filter) =>
                    onViewChart({
                      condition,
                      treatment,
                      sample_type: sampleType,
                      ...filter,
                    })
                  }
                />
              </div>

              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-[#555] transition-colors hover:text-[#0d0d0d]">
                  Matching sample IDs ({data.sample_ids.length.toLocaleString()}
                  )
                </summary>
                <p className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#e5e0d9] bg-[#f9f6f2] p-3 font-mono text-xs leading-5 break-all text-[#666]">
                  {data.sample_ids.join(", ")}
                </p>
              </details>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() =>
                    onViewFrequencies({
                      sampleIds: data.sample_ids,
                      label,
                    })
                  }
                  className="rounded-lg border border-[#e5e0d9] bg-white px-3 py-1.5 text-sm text-[#333] transition-colors hover:border-[#ccc] hover:bg-[#f9f6f2] disabled:opacity-40"
                >
                  View frequencies · {condition} / {treatment} / {sampleType}
                </button>
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() =>
                    onViewChart({
                      condition,
                      treatment,
                      sample_type: sampleType,
                    })
                  }
                  className="rounded-lg border border-[#e5e0d9] bg-white px-3 py-1.5 text-sm text-[#333] transition-colors hover:border-[#ccc] hover:bg-[#f9f6f2] disabled:opacity-40"
                >
                  View responder chart · {condition} / {treatment} /{" "}
                  {sampleType}
                </button>
              </div>
            </>
          )}
        </FadeIn>
      )}
    </div>
  );
}
