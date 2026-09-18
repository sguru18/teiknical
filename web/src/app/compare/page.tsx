"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FrequencyBoxPlot } from "@/components/FrequencyBoxPlot";
import {
  fetchJson,
  type Aggregation,
  type CompareResponse,
  type FilterOptions,
} from "@/lib/api";

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  baseline: "Baseline samples only",
  subject_mean: "Mean across timepoints",
  all_samples: "All samples (not independent)",
};

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
        // Fixed width: a select sizes to its widest option, so it would jump
        // when the fetched options replace the single placeholder.
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

export default function ComparePage() {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregation, setAggregation] = useState<Aggregation>("baseline");

  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [condition, setCondition] = useState("melanoma");
  const [treatment, setTreatment] = useState("miraclib");
  const [sampleType, setSampleType] = useState("PBMC");

  useEffect(() => {
    fetchJson<FilterOptions>("/api/filters").then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    fetchJson<CompareResponse>("/api/compare", {
      aggregation,
      condition,
      treatment,
      sample_type: sampleType,
    })
      .then((next) => {
        // Keep the previous result on screen until the new one arrives, so the
        // chart and table do not unmount and collapse the page height.
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
  }, [aggregation, condition, treatment, sampleType]);

  const significant = data?.tests.filter((t) => t.significant) ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl p-8 font-sans">
      <div className="flex gap-4 text-sm">
        <Link href="/" className="text-blue-700 underline">
          ← Frequency summary
        </Link>
        <Link href="/cohort" className="text-blue-700 underline">
          Cohort breakdown →
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">
        Responders vs non-responders
      </h1>
      <p className="mt-1 text-sm text-zinc-600 min-h-[1.25rem]">
        {data
          ? `${data.filters.condition} patients on ${data.filters.treatment}, ${data.filters.sample_type} samples · ${data.n_subjects} subjects`
          : null}
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
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="text-zinc-600">Repeated measures:</span>
        {(Object.keys(AGGREGATION_LABELS) as Aggregation[]).map((key) => (
          <button
            key={key}
            onClick={() => setAggregation(key)}
            className={`rounded border px-3 py-1 ${
              aggregation === key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300"
            }`}
          >
            {AGGREGATION_LABELS[key]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Chart area is always reserved at full height so the page does not
          shift when data arrives. The skeleton shows while loading. */}
      <div className="mt-6 h-[480px] w-full">
        {!data && !error && (
          <div className="h-full w-full animate-pulse rounded bg-zinc-100" />
        )}
        {data && <FrequencyBoxPlot points={data.points} />}
      </div>

      {data && (
        <div
          className={
            loading ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          {data.tests.length === 0 ? (
            <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              No samples match this combination, or none of the matching
              subjects have a recorded response. Healthy controls are untreated
              and have no response, so they cannot be compared.
            </p>
          ) : (
            <>
              <p className="mt-4 rounded bg-zinc-100 p-3 text-sm text-zinc-700">
                {data.aggregation_note}
              </p>

          <h2 className="mt-8 text-lg font-semibold">Statistical tests</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {data.test}, {data.correction} across {data.tests.length}{" "}
            populations, α = {data.alpha}.
          </p>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left">
                <th className="py-2 pr-4 font-medium">population</th>
                <th className="py-2 pr-4 font-medium">median (resp)</th>
                <th className="py-2 pr-4 font-medium">median (non-resp)</th>
                <th className="py-2 pr-4 font-medium">difference</th>
                <th className="py-2 pr-4 font-medium">p</th>
                <th className="py-2 pr-4 font-medium">q (BH)</th>
                <th className="py-2 pr-4 font-medium">effect size</th>
                <th className="py-2 font-medium">significant</th>
              </tr>
            </thead>
            <tbody>
              {data.tests.map((test) => (
                <tr
                  key={test.population}
                  className={test.significant ? "bg-amber-50" : undefined}
                >
                  <td className="py-1.5 pr-4">{test.population}</td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {test.median_responders.toFixed(2)}%
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {test.median_non_responders.toFixed(2)}%
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {test.median_difference >= 0 ? "+" : ""}
                    {test.median_difference.toFixed(2)}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {test.p_value.toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {test.p_value_adjusted.toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {test.effect_size.toFixed(3)}
                  </td>
                  <td className="py-1.5">{test.significant ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-sm text-zinc-700">
            {significant.length === 0 ? (
              <>
                No population shows a significant difference in relative
                frequency between responders and non-responders (all
                BH-adjusted q &gt; {Math.min(
                  ...data.tests.map((t) => t.p_value_adjusted),
                ).toFixed(2)}
                ). Effect sizes are negligible, so this is an absence of signal
                rather than an underpowered test.
              </>
            ) : (
              <>
                Significant after correction:{" "}
                {significant.map((t) => t.population).join(", ")}.
              </>
            )}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
