"use client";

import { useEffect, useState } from "react";

import { CohortBreakdown } from "@/components/CohortBreakdown";
import { CompareAnalysis } from "@/components/CompareAnalysis";
import { FrequencySummary } from "@/components/FrequencySummary";
import { loadPlotly } from "@/components/FrequencyBoxPlot";
import { prefetchDefaults } from "@/lib/api";
import type { ComparePreset, SummaryFilter } from "@/lib/navigation";

type Tab = "summary" | "compare" | "cohort";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Frequency summary" },
  { id: "compare", label: "Responders vs non-responders" },
  { id: "cohort", label: "Cohort breakdown" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [warmCompare, setWarmCompare] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter | null>(
    null,
  );
  // Bump nonce so re-clicking the same cohort still re-applies the preset.
  const [comparePreset, setComparePreset] = useState<{
    value: ComparePreset;
    nonce: number;
  } | null>(null);

  useEffect(() => {
    void loadPlotly();
    void prefetchDefaults().then(() => setWarmCompare(true));
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl px-8 pb-16">
      {/* Tab bar — white card on cream bg, matching Teiko's nav style */}
      <div className="mt-8 bg-white rounded-xl border border-[#e5e0d9] px-2">
        <div className="flex items-center">
          <span className="px-4 text-sm font-bold text-[#e5341a] shrink-0">
            Teiknical
          </span>
          <div className="w-px h-5 bg-[#e5e0d9] shrink-0" />
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-4 text-sm font-medium transition-colors focus:outline-none ${
                activeTab === tab.id
                  ? "text-[#e5341a]"
                  : "text-[#555] hover:text-[#0d0d0d]"
              }`}
            >
              {tab.label}
              <span
                className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all ${
                  activeTab === tab.id ? "bg-[#e5341a]" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Keep compare mounted (invisible, not display:none) so Plotly can
          measure a real width and draw while another tab is open. */}
      <div className="relative mt-4 bg-white rounded-xl border border-[#e5e0d9] px-8 py-8">
        <div className={activeTab === "summary" ? undefined : "hidden"}>
          <FrequencySummary
            filter={summaryFilter}
            onClearFilter={() => setSummaryFilter(null)}
          />
        </div>
        {warmCompare && (
          <div
            className={
              activeTab === "compare"
                ? undefined
                : "invisible pointer-events-none absolute inset-x-8 top-8"
            }
            aria-hidden={activeTab !== "compare"}
          >
            <CompareAnalysis
              active={activeTab === "compare"}
              preset={comparePreset?.value ?? null}
              presetKey={comparePreset?.nonce ?? 0}
            />
          </div>
        )}
        <div className={activeTab === "cohort" ? undefined : "hidden"}>
          <CohortBreakdown
            onViewFrequencies={(filter) => {
              setSummaryFilter(filter);
              setActiveTab("summary");
            }}
            onViewChart={(preset) => {
              setComparePreset((prev) => ({
                value: preset,
                nonce: (prev?.nonce ?? 0) + 1,
              }));
              setWarmCompare(true);
              setActiveTab("compare");
            }}
          />
        </div>
      </div>
    </main>
  );
}
