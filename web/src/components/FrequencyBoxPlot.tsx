"use client";

import { useEffect, useRef } from "react";

import type { FrequencyPoint } from "@/lib/api";

// Loaded lazily inside the effect: plotly.js touches `document` at import time,
// so a top-level import would break Next's server render.
type PlotlyModule = typeof import("plotly.js-dist-min");
let plotlyPromise: Promise<PlotlyModule> | null = null;

function loadPlotly() {
  plotlyPromise ??= import("plotly.js-dist-min");
  return plotlyPromise;
}

const COLORS = { yes: "#2563eb", no: "#dc2626" };

export function FrequencyBoxPlot({ points }: { points: FrequencyPoint[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

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
        };
      });

      Plotly.newPlot(
        container.current,
        traces,
        {
          boxmode: "group",
          yaxis: { title: { text: "Relative frequency (%)" }, zeroline: false },
          xaxis: { title: { text: "Population" } },
          margin: { t: 20, r: 20, b: 60, l: 60 },
          legend: { orientation: "h", y: -0.2 },
          font: { family: "var(--font-geist-sans), system-ui, sans-serif" },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
        },
        { responsive: true, displayModeBar: false },
      );
    });

    const node = container.current;
    return () => {
      cancelled = true;
      if (node) loadPlotly().then((Plotly) => Plotly.purge(node));
    };
  }, [points]);

  return <div ref={container} className="h-[480px] w-full" />;
}
