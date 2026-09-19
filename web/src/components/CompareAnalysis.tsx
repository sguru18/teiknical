"use client";

import { useEffect, useState } from "react";

import { FrequencyBoxPlot } from "@/components/FrequencyBoxPlot";
import { FadeIn } from "@/components/FadeIn";
import { Select } from "@/components/Select";
import {
  cachedFetch,
  DEFAULT_COMPARE_PARAMS,
  peekCached,
  type Aggregation,
  type CompareResponse,
  type FilterOptions,
} from "@/lib/api";
import type { ComparePreset } from "@/lib/navigation";

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  baseline: "Baseline (day 0)",
  day7: "Day 7",
  day14: "Day 14",
};

export function CompareAnalysis({
  active = true,
  preset = null,
  presetKey = 0,
}: {
  active?: boolean;
  /** When set from the cohort tab, sync the dropdowns to this arm. */
  preset?: ComparePreset | null;
  /** Bumped on each cohort navigate so the same arm can be re-applied. */
  presetKey?: number;
}) {
  const [aggregation, setAggregation] = useState<Aggregation>(
    DEFAULT_COMPARE_PARAMS.aggregation,
  );
  const [condition, setCondition] = useState<string>(
    DEFAULT_COMPARE_PARAMS.condition,
  );
  const [treatment, setTreatment] = useState<string>(
    DEFAULT_COMPARE_PARAMS.treatment,
  );
  const [sampleType, setSampleType] = useState<string>(
    DEFAULT_COMPARE_PARAMS.sample_type,
  );

  useEffect(() => {
    if (!preset) return;
    setCondition(preset.condition);
    setTreatment(preset.treatment);
    setSampleType(preset.sample_type);
  }, [preset, presetKey]);

  const [options, setOptions] = useState<FilterOptions | null>(
    () => peekCached("/api/filters") ?? null,
  );
  const [data, setData] = useState<CompareResponse | null>(
    () => peekCached("/api/compare", DEFAULT_COMPARE_PARAMS) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => data === null);

  useEffect(() => {
    cachedFetch<FilterOptions>("/api/filters")
      .then(setOptions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = {
      aggregation,
      condition,
      treatment,
      sample_type: sampleType,
    };
    const cached = peekCached<CompareResponse>("/api/compare", params);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setLoading(true);

    cachedFetch<CompareResponse>("/api/compare", params)
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

  /** Format a p-value: scientific notation when < 0.0001, fixed otherwise. */
  const fmtP = (p: number) =>
    isNaN(p) ? "—" : p < 0.0001 ? p.toExponential(2) : p.toFixed(4);
  const isEmpty =
    data !== null &&
    (data.n_samples === 0 ||
      data.points.length === 0 ||
      data.tests.length === 0);

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
          Timepoint
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
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl bg-[#f0ebe4]">
            {/* animated bar skeleton mimicking the five boxplot columns */}
            <div className="flex items-end gap-3 h-32 px-8 w-full max-w-sm">
              {[
                { h: 0.55, delay: "0s" },
                { h: 0.75, delay: "0.15s" },
                { h: 0.45, delay: "0.3s" },
                { h: 0.85, delay: "0.45s" },
                { h: 0.6,  delay: "0.6s" },
              ].map(({ h, delay }, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-[#e5341a]/25 animate-pulse"
                  style={{ height: `${h * 100}%`, animationDelay: delay }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {["0s", "0.2s", "0.4s"].map((delay, i) => (
                <span
                  key={i}
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[#e5341a]/60 animate-pulse"
                  style={{ animationDelay: delay }}
                />
              ))}
              <span className="ml-1.5 text-xs font-medium tracking-widest uppercase text-[#bbb]">Calculating</span>
            </div>
          </div>
        )}
        {data && !loading && isEmpty && (
          <div className="flex h-full w-full items-center justify-center rounded-xl border border-[#e5e0d9] bg-white px-6 text-center text-sm text-[#555]">
            No samples match this combination, or none of the matching subjects
            have a recorded response. Healthy controls are untreated and have no
            response, so they cannot be compared.
          </div>
        )}
        {data && !loading && !isEmpty && (
          <FrequencyBoxPlot points={data.points} active={active} />
        )}
      </div>

      {data && !isEmpty && (
        <FadeIn
          key={`${data.filters.condition}-${data.filters.treatment}-${data.filters.sample_type}-${data.aggregation}`}
          className={
            loading ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          <p className="mt-4 rounded-lg border border-[#e5e0d9] bg-[#f9f6f2] p-3 text-sm text-[#555]">
            {data.aggregation_note}
          </p>

          {/* Statistical tests section */}
          <div className="mt-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#e5341a]">
              Statistical tests
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e5e0d9] text-left">
                  {[
                    "population",
                    "median (resp)",
                    "median (non-resp)",
                    "difference",
                    "p",
                    "q (BH-adjusted p)",
                    "effect size",
                    "significant",
                    "SW p (resp)",
                    "SW p (non-resp)",
                    "normal?",
                    "Welch p (if normal)",
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
                    className={test.significant ? "bg-[#fff8f5]" : undefined}
                  >
                    <td className="py-1.5 pr-4 whitespace-nowrap text-[#333]">
                      {test.population}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.median_responders.toFixed(2)}%
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.median_non_responders.toFixed(2)}%
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.median_difference >= 0 ? "+" : ""}
                      {test.median_difference.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.p_value.toFixed(4)}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.p_value_adjusted.toFixed(4)}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.effect_size.toFixed(3)}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap text-[#333]">
                      {test.significant ? "yes" : "no"}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {fmtP(test.shapiro_p_responders)}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {fmtP(test.shapiro_p_non_responders)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 whitespace-nowrap font-medium ${test.normality_rejected ? "text-[#e5341a]" : "text-[#333]"}`}
                    >
                      {test.normality_rejected
                        ? "no → MWU ✓"
                        : "yes → t-test ok"}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums text-[#333]">
                      {test.p_value_welch != null
                        ? fmtP(test.p_value_welch)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-[#555]">
            Methodology: A Mann-Whitney U test is used to determine whether
            responder / non-responder distributions are significantly different,
            without assuming that the distributions are normal (as would be
            required for a standard t-test, alongside equal variance).
            Benjamini-Hochberg false discovery rate correction is used to adjust
            the MWU p-value with α=0.05, per convention. The MWU effect size is
            calculated to provide magnitude context for the adjusted p-values.
            Finally, the Shapiro-Wilk test is used on each group independently
            to check whether the individual distributions are normal, in which
            case a Welch t-test is provided as a secondary result (a t-test that
            does not assume equal variances between distributions).
          </p>
        </FadeIn>
      )}
    </div>
  );
}
