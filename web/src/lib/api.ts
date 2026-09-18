import type { components } from "@/types/api";

// Aliases so components import `SummaryRow` rather than the generated
// components["schemas"][...] path. Regenerate with `npm run gen:types`.
export type SummaryRow = components["schemas"]["SummaryRow"];
export type SummaryResponse = components["schemas"]["SummaryResponse"];

// Relative URL: resolves against the page origin, which Next proxies to
// FastAPI. Keeps the backend address out of the browser bundle.
export async function fetchJson<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }

  const suffix = query.toString() ? `?${query}` : "";
  const res = await fetch(`${path}${suffix}`);

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }

  return res.json() as Promise<T>;
}
