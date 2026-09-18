"use client";

import { useEffect, useRef, useState } from "react";

import type { FrequencyPoint } from "@/lib/api";

// Loaded lazily inside the effect: plotly.js touches `document` at import time,
// so a top-level import would break Next's server render.
type PlotlyModule = typeof import("plotly.js-dist-min");
let plotlyPromise: Promise<PlotlyModule> | null = null;

export function loadPlotly() {
  plotlyPromise ??= import("plotly.js-dist-min");
  return plotlyPromise;
}

const COLORS = { yes: "#2563eb", no: "#dc2626" };

export function FrequencyBoxPlot({
  points,
  active = true,
}: {
  points: FrequencyPoint[];
  active?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || !container.current) return;
    const node = container.current;
    loadPlotly().then((Plotly) => Plotly.Plots.resize(node));
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    loadPlotly().then((Plotly) => {
      if (cancelled || !container.current) return;

      // One trace per response group, both plotted against the population
      // axis, so Plotly pairs the boxes side by side within each population.
      const traces = (["yes", "no"] as const).map((response) => {
        const group = points.filter((p) => p.response === response);
        return {
          type: "box" as const,
          name: response === "yes" ? "Responder" : "Non-responder",
          x: group.map((p) => p.population),
          y: group.map((p) => p.percentage),
          marker: { color: COLORS[response], size: 3, opacity: 0.35 },
          line: { width: 1.5 },
          // Individual observations behind the box; with effects this small the
          // overlap between groups is the point worth seeing.
          boxpoints: "all" as const,
          jitter: 0.5,
          pointpos: 0,
          hovertemplate: "%{y:.2f}%<extra></extra>",
          showlegend: false,
        };
      });

      Plotly.newPlot(
        container.current,
        traces,
        {
          boxmode: "group",
          autosize: true,
          showlegend: false,
          // Tick labels only — legend and axis titles are HTML around this
          // div, because Plotly draws them outside the plot and they either
          // spill onto the page or get clipped by the 480px box.
          xaxis: { automargin: false, tickfont: { size: 11 } },
          yaxis: { automargin: false, zeroline: false, tickfont: { size: 11 } },
          margin: { t: 8, r: 12, b: 48, l: 44 },
          font: { family: "var(--font-geist-sans), system-ui, sans-serif" },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
        },
        { responsive: true, displayModeBar: false },
      ).then(() => {
        if (cancelled || !container.current) return;
        Plotly.Plots.resize(container.current);
        if (!cancelled) setReady(true);
      });
    });

    const node = container.current;
    return () => {
      cancelled = true;
      if (node) loadPlotly().then((Plotly) => Plotly.purge(node));
    };
  }, [points]);

  return (
    <div className="relative flex h-[480px] w-full flex-col">
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#f0ebe4] text-sm text-[#999] transition-opacity duration-500 ease-out ${
          ready ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        Loading…
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-500 ease-out ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-center justify-center gap-5 pb-1 text-sm text-[#333]">
          <LegendSwatch color={COLORS.yes} label="Responder" />
          <LegendSwatch color={COLORS.no} label="Non-responder" />
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="relative w-8 shrink-0">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-xs text-[#555]">
              Relative frequency (%)
            </span>
          </div>
          <div ref={container} className="h-full min-w-0 flex-1" />
        </div>

        <p className="shrink-0 pb-1 text-center text-xs text-[#555]">
          Population
        </p>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
