import type { components } from "@/types/api";

// Aliases so components import `SummaryRow` rather than the generated
// components["schemas"][...] path. Regenerate with `npm run gen:types`.
export type SummaryRow = components["schemas"]["SummaryRow"];
export type SummaryResponse = components["schemas"]["SummaryResponse"];
export type CompareResponse = components["schemas"]["CompareResponse"];
export type FrequencyPoint = components["schemas"]["FrequencyPoint"];
export type PopulationTest = components["schemas"]["PopulationTest"];
export type FilterOptions = components["schemas"]["FilterOptions"];
export type CohortResponse = components["schemas"]["CohortResponse"];
export type CategoryCount = components["schemas"]["CategoryCount"];
// Literal type aliases are inlined by Pydantic rather than emitted as named
// schemas, so derive it from the field that uses it.
export type Aggregation = CompareResponse["aggregation"];

export type QueryParams = Record<
  string,
  string | number | string[] | undefined
>;

export const DEFAULT_COMPARE_PARAMS = {
  condition: "melanoma",
  treatment: "miraclib",
  sample_type: "PBMC",
  aggregation: "baseline",
} as const;

export const DEFAULT_COHORT_PARAMS = {
  condition: "melanoma",
  treatment: "miraclib",
  sample_type: "PBMC",
  time_from_treatment_start: 0,
} as const;

export const SUMMARY_PAGE_SIZE = 50;

// Treated disease arms only. healthy/none is left to load on demand.
export const PREFETCH_COMPARE_COMBOS = [
  { condition: "melanoma", treatment: "miraclib" },
  { condition: "melanoma", treatment: "phauximab" },
  { condition: "carcinoma", treatment: "miraclib" },
  { condition: "carcinoma", treatment: "phauximab" },
] as const;

function requestUrl(path: string, params: QueryParams = {}): string {
  const query = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      // FastAPI list query params: ?sample=a&sample=b
      for (const item of value) query.append(key, String(item));
    } else {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString() ? `?${query}` : "";
  return `${path}${suffix}`;
}

// Relative URL: resolves against the page origin, which Next proxies to
// FastAPI. Keeps the backend address out of the browser bundle.
export async function fetchJson<T>(
  path: string,
  params: QueryParams = {},
): Promise<T> {
  const res = await fetch(requestUrl(path, params));

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// POST variant for large sample-id lists (cohort pull). GET query strings
// hit URL length limits around a few hundred ids.
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// Session cache. The SQLite file is built once by the pipeline, so a given
// filter combo always returns the same JSON. Cache the in-flight promise as
// well as the resolved value so a prefetch and a later mount share one request.
type CacheEntry = { promise: Promise<unknown>; value?: unknown };
const cache = new Map<string, CacheEntry>();

export function peekCached<T>(
  path: string,
  params: QueryParams = {},
): T | undefined {
  return cache.get(requestUrl(path, params))?.value as T | undefined;
}

export function cachedFetch<T>(
  path: string,
  params: QueryParams = {},
): Promise<T> {
  const key = requestUrl(path, params);
  const existing = cache.get(key);
  if (existing) {
    console.debug(`[teiknical] cache HIT  ${key}`);
    return existing.promise as Promise<T>;
  }

  const t0 = performance.now();
  console.debug(`[teiknical] fetch START ${key}`);

  const promise = fetchJson<T>(path, params).then((value) => {
    const ms = (performance.now() - t0).toFixed(0);
    console.debug(`[teiknical] fetch DONE  ${key} (${ms}ms)`);
    const entry = cache.get(key);
    if (entry) entry.value = value;
    return value;
  });
  promise.catch((e) => {
    const ms = (performance.now() - t0).toFixed(0);
    console.warn(`[teiknical] fetch ERROR ${key} (${ms}ms)`, e);
    cache.delete(key);
  });
  cache.set(key, { promise });
  return promise;
}

export async function prefetchDefaults(): Promise<void> {
  void cachedFetch<FilterOptions>("/api/filters");
  void cachedFetch<CohortResponse>("/api/cohort", DEFAULT_COHORT_PARAMS);

  const firstPage = cachedFetch<SummaryResponse>("/api/summary", {
    limit: SUMMARY_PAGE_SIZE,
    offset: 0,
  });
  void cachedFetch<SummaryResponse>("/api/summary", {
    limit: SUMMARY_PAGE_SIZE,
    offset: SUMMARY_PAGE_SIZE,
  });

  await firstPage;

  // Compare is the expensive endpoint (pandas + Shapiro-Wilk + Mann-Whitney).
  // Sequential — the backend is single-worker so parallel requests queue anyway
  // and the contention makes each one slower.
  void (async () => {
    for (const combo of PREFETCH_COMPARE_COMBOS) {
      await cachedFetch<CompareResponse>("/api/compare", {
        ...combo,
        sample_type: DEFAULT_COMPARE_PARAMS.sample_type,
        aggregation: DEFAULT_COMPARE_PARAMS.aggregation,
      });
    }
  })();
}
