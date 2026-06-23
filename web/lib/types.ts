export type BrandExtraction = {
  name: string;
  mentioned: boolean;
  position: number | null;
  recommended: boolean;
  sentiment: string;
  context: string;
};

export type Extraction = {
  brands: BrandExtraction[];
  other_brands_mentioned: string[];
  error?: string;
};

export type EngineResult = {
  prompt: string;
  engine: string;
  model: string;
  ok: boolean;
  error: string | null;
  latency_ms?: number;
  answer: string;
  extraction: Extraction | null;
};

export type AuditRun = {
  run_id: string;
  category: string;
  tracked_brands: string[];
  engines: string[];
  prompt_count: number;
  prompts: string[];
  results: EngineResult[];
};

export type BrandScore = {
  name: string;
  mentions: number;
  recommendations: number;
  share_of_voice: number;
  recommendation_rate: number;
  avg_position: number | null;
  sentiment: Record<string, number>;
  gap_prompts: string[];
};

export type ScoreReport = {
  category: string;
  tracked_brands: string[];
  considered_prompts: number;
  total_prompts: number;
  engines: string[];
  brand_scores: BrandScore[];
  per_engine_share: Record<string, Record<string, number>>;
  untracked_brands: Record<string, number>;
  coverage: Record<string, { ok: number; failed: number }>;
};

export type RunIndexEntry = {
  run_id: string;
  category: string;
  created: string;
  engines: string[];
  prompt_count: number;
};

export type RunIndex = {
  latest: string | null;
  runs: RunIndexEntry[];
};
