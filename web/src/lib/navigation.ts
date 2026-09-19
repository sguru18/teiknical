/** Cross-tab navigation state, owned by the home page. */

export type SummaryFilter = {
  sampleIds: string[];
  /** Short label for the banner, e.g. "melanoma · miraclib · PBMC · day 0". */
  label: string;
};

export type ComparePreset = {
  condition: string;
  treatment: string;
  sample_type: string;
  sex?: string;
  proj_id?: string;
};
