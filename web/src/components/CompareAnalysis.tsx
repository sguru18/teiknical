"use client";

import { useEffect, useState } from "react";

import { FrequencyBoxPlot, loadPlotly } from "@/components/FrequencyBoxPlot";
import { FadeIn } from "@/components/FadeIn";
import { Select } from "@/components/Select";
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

export function CompareAnalysis() {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregation, setAggregation] = useState<Aggregation>("baseline");

  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [condition, setCondition] = useState("melanoma");
  const [treatment, setTreatment] = useState("miraclib");
  const [sampleType, setSampleType] = useState("PBMC");

  useEffect(() => {
    // Kick off the Plotly chunk now, in parallel with /api/compare, instead of
    // waiting until FrequencyBoxPlot mounts after the response arrives.
    void loadPlotly();
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
    <div>
      {/* Teiko-style eyebrow + heading */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
        Statistical comparison
      </p>
      <h2 className="mt-1 text-2xl font-bold text-[#0d0d0d]">
        Responders vs non-responders
      </h2>
      {/* min-h reserves the line so the page doesn't shift when data arrives */}
      <div className="mt-1 min-h-[1.25rem] text-sm text-[#666]">
        {data && !loading && (
          <FadeIn
            key={`${data.filters.condition}-${data.filters.treatment}-${data.filters.sample_type}-${data.n_subjects}`}
          >
            {`${data.filters.condition} · ${data.filters.treatment} · ${data.filters.sample_type} · ${data.n_subjects} subjects`}
          </FadeIn>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-6">
        <Select
          label="Condition"
          value={condition}
          options={options?.conditions}
          onChange={setCondition}
          disabled={loading}
        />
        <Select
          label="Treatment"
          value={treatment}
          options={options?.treatments}
          onChange={setTreatment}
          disabled={loading}
        />
        <Select
          label="Sample type"
          value={sampleType}
          options={options?.sample_types}
          onChange={setSampleType}
          disabled={loading}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#999]">
          Repeated measures
        </span>
        {(Object.keys(AGGREGATION_LABELS) as Aggregation[]).map((key) => (
          <button
            key={key}
            onClick={() => setAggregation(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              aggregation === key
                ? "border-[#e5341a] bg-[#e5341a] text-white"
                : "border-[#e5e0d9] text-[#555] hover:border-[#ccc] hover:text-[#0d0d0d]"
            }`}
          >
            {AGGREGATION_LABELS[key]}
          </button>
        ))}
      </div>

      {error && (
        <FadeIn>
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        </FadeIn>
      )}

      {/* Chart area is always reserved at full height so the page does not
          shift when data arrives. The skeleton shows while loading. */}
      <div className="mt-6 h-[480px] w-full">
        {(loading || !data) && !error && (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#f0ebe4] text-sm text-[#999]">
            Loading…
          </div>
        )}
        {data && !loading && <FrequencyBoxPlot points={data.points} />}
      </div>

      {data && (
        <FadeIn
          key={`${data.filters.condition}-${data.filters.treatment}-${data.filters.sample_type}-${data.aggregation}`}
          className={
            loading ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          {data.tests.length === 0 ? (
            <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No samples match this combination, or none of the matching
              subjects have a recorded response. Healthy controls are untreated
              and have no response, so they cannot be compared.
            </p>
          ) : (
            <>
              <p className="mt-4 rounded-lg border border-[#e5e0d9] bg-[#f9f6f2] p-3 text-sm text-[#555]">
                {data.aggregation_note}
              </p>

              {/* Statistical tests section */}
              <div className="mt-8">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
                  Statistical tests
                </p>
                <p className="mt-1 text-sm text-[#666]">
                  {data.test}, {data.correction} across {data.tests.length}{" "}
                  populations, α = {data.alpha}.
                </p>
              </div>

              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e5e0d9] text-left">
                    {[
                      "population",
                      "median (resp)",
                      "median (non-resp)",
                      "difference",
                      "p",
                      "q (BH)",
                      "effect size",
                      "significant",
                    ].map((h) => (
                      <th
                        key={h}
                        className="py-2 pr-4 last:pr-0 text-[10px] font-semibold uppercase tracking-widest text-[#999]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.tests.map((test) => (
                    <tr
                      key={test.population}
                      className={
                        test.significant ? "bg-[#fff8f5]" : undefined
                      }
                    >
                      <td className="py-1.5 pr-4 text-[#333]">
                        {test.population}
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-[#333]">
                        {test.median_responders.toFixed(2)}%
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-[#333]">
                        {test.median_non_responders.toFixed(2)}%
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-[#333]">
                        {test.median_difference >= 0 ? "+" : ""}
                        {test.median_difference.toFixed(2)}
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-[#333]">
                        {test.p_value.toFixed(4)}
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-[#333]">
                        {test.p_value_adjusted.toFixed(4)}
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-[#333]">
                        {test.effect_size.toFixed(3)}
                      </td>
                      <td className="py-1.5 text-[#333]">
                        {test.significant ? "yes" : "no"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-4 text-sm text-[#555]">
                {significant.length === 0 ? (
                  <>
                    No population shows a significant difference in relative
                    frequency between responders and non-responders (all
                    BH-adjusted q &gt;{" "}
                    {Math.min(
                      ...data.tests.map((t) => t.p_value_adjusted),
                    ).toFixed(2)}
                    ). Effect sizes are negligible, so this is an absence of
                    signal rather than an underpowered test.
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
        </FadeIn>
      )}
    </div>
  );
}
