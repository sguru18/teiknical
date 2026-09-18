"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchJson,
  type CategoryCount,
  type CohortResponse,
  type FilterOptions,
} from "@/lib/api";

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[] | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!options}
        className="w-44 rounded border border-zinc-300 bg-white px-2 py-1"
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

// One component for all three breakdowns, which is what CategoryCount is for.
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
    <div className="flex-1 rounded border border-zinc-200 p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">
        {total.toLocaleString()} {unit}
      </p>
      <ul className="mt-3 space-y-2">
        {counts.map((c) => (
          <li key={c.label}>
            <div className="flex justify-between text-sm">
              <span>{c.label}</span>
              <span className="tabular-nums text-zinc-600">
                {c.count.toLocaleString()}
                {total > 0 && (
                  <span className="ml-2 text-xs text-zinc-400">
                    {((100 * c.count) / total).toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded bg-zinc-100">
              <div
                className="h-1.5 rounded bg-zinc-700"
                style={{ width: total > 0 ? `${(100 * c.count) / total}%` : 0 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CohortPage() {
  const [data, setData] = useState<CohortResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [condition, setCondition] = useState("melanoma");
  const [treatment, setTreatment] = useState("miraclib");
  const [sampleType, setSampleType] = useState("PBMC");
  const [timepoint, setTimepoint] = useState("0");

  useEffect(() => {
    fetchJson<FilterOptions>("/api/filters").then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    fetchJson<CohortResponse>("/api/cohort", {
      condition,
      treatment,
      sample_type: sampleType,
      time_from_treatment_start: timepoint,
    })
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

  return (
    <main className="mx-auto max-w-5xl p-8 font-sans">
      <Link href="/compare" className="text-sm text-blue-700 underline">
        ← Responders vs non-responders
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Cohort breakdown</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Samples matching a single treatment arm at one timepoint, broken down by
        project, response and sex.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4 text-sm">
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
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!data && !error && <p className="mt-6 text-sm text-zinc-500">Loading…</p>}

      {data && (
        <div
          className={
            loading ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          <p className="mt-6 text-sm text-zinc-700">
            {data.n_samples.toLocaleString()} samples from{" "}
            {data.n_subjects.toLocaleString()} subjects.
          </p>

          {data.n_samples === 0 ? (
            <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              No samples match this combination.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-4">
                <Breakdown
                  title="Samples per project"
                  unit="samples"
                  counts={data.samples_by_project}
                />
                <Breakdown
                  title="Subjects by response"
                  unit="subjects"
                  counts={data.subjects_by_response}
                />
                <Breakdown
                  title="Subjects by sex"
                  unit="subjects"
                  counts={data.subjects_by_sex}
                />
              </div>

              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-zinc-700">
                  Matching sample ids ({data.sample_ids.length.toLocaleString()})
                </summary>
                <p className="mt-2 max-h-48 overflow-y-auto rounded bg-zinc-50 p-3 font-mono text-xs leading-5 break-all text-zinc-600">
                  {data.sample_ids.join(", ")}
                </p>
              </details>
            </>
          )}
        </div>
      )}
    </main>
  );
}
