# Surfaced by KAPS

Surfaced by KAPS is a GEO visibility dashboard for measuring how often AI answer engines mention and recommend tracked brands for buyer-intent prompts.

The app is now split into two parts:

- `audit/`: the verified Python audit engine. It generates prompts, calls configured answer engines, extracts structured evidence, caches responses, and writes committed audit JSON.
- `web/`: a read-only Next.js app. It renders committed audit JSON with a TypeScript scorer that matches `audit/score.py`.

The deployed site does not make live LLM calls. Scheduled refreshes run in GitHub Actions, commit new data into `data/runs/`, and trigger a Vercel rebuild.

## Local Web App

```bash
cd surfaced/web
npm install
npm run dev
```

The Next.js app reads `../data/index.json` and `../data/runs/*.json` at build time. The sample run is committed in two forms:

- `data/runs/sample_run.json` for tests.
- `data/runs/20260622-153012.json` for manifest-based loading by run id.

## Local Checks

```bash
cd surfaced/web
npm test
npm run build
```

The scorer test compares `web/lib/score.ts` against a Python-generated fixture from `audit/score.py`.

## Refresh Audits

With API keys in `.env`, run:

```bash
cd surfaced
python3 -m venv .venv
source .venv/bin/activate
pip install -r audit/requirements.txt
python audit/refresh.py
```

`audit/refresh.py` refreshes the configured category presets, validates every new run with `score.score_run`, writes `data/runs/<run_id>.json`, and rebuilds `data/index.json`. Runs with zero usable extracted results fail validation and are not committed.

## GitHub Action

`.github/workflows/refresh-audits.yml` runs weekly and on manual dispatch. It installs `audit/requirements.txt`, runs `python surfaced/audit/refresh.py`, and commits `surfaced/data/` if data changed.

Required GitHub Action secrets:

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY` if used

Ollama is skipped in CI unless reachable, which hosted runners normally are not.

## Vercel

Set the Vercel project root to:

```text
surfaced/web
```

Use the standard Next.js build command:

```bash
next build
```

No Vercel environment variables are required for rendering because the site only reads committed JSON. The data loader reads from `path.join(process.cwd(), "..", "data")`, which points from `surfaced/web` to `surfaced/data` during the Vercel build.

## What It Measures

- Share of voice: considered prompts where a tracked brand appears.
- Recommendation rate: considered prompts where a tracked brand is explicitly recommended.
- Average position: mean first-mention rank when the brand appears.
- Gap prompts: prompts where a competitor appears and the primary brand is absent.
- Untracked brands: named competitors outside the tracked set.

`audit/score.py` remains the reference scorer. It is pure and deterministic, with no disk, network, or LLM calls.
