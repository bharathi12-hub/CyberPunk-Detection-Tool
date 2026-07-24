# AI System

The AI layer turns structured scan data into short, plain-English explanations. It is **optional** —
when unavailable, the extension instantly falls back to local rule-based text.

## How it works

1. `extension/ai/risk-explainer.js` (or `phishing-explainer.js`) posts the structured scan object to
   the backend with a hard **2.5-second timeout**.
2. `backend/api/controllers/aiController.js` calls the Anthropic Messages API via
   `@anthropic-ai/sdk`, using model **`claude-sonnet-5`** with `max_tokens: 400`.
3. The first text block of the response is returned as `{ "explanation": "…" }`.
4. If the key is missing, the call fails, or the timeout fires, the extension renders a local
   rule-based summary instead. **The UI never blocks on the AI.**

## Privacy design

The model receives **only the structured scan JSON** — scores, counts, booleans, and hostnames. It
never receives raw page content, form values, or credentials. See [`../PRIVACY.md`](../PRIVACY.md).

## Prompts

Both prompts constrain the model strictly to the supplied data:

- **Risk explanation** — 2–4 sentences summarizing the site's safety, factual only, no speculation.
- **Phishing explanation** — 1–3 sentences naming the specific reasons a page was or wasn't flagged
  (homograph attack, brand impersonation, suspicious form action, …).

## Configuration

```ini
ANTHROPIC_API_KEY=      # optional — omit to always use local fallback text
```

Endpoints: `POST /api/ai/explain-risk` and `POST /api/ai/explain-phishing`
(see [API.md](API.md#ai)).

## Note on "AI" vs "ML"

The **explanations** are LLM-generated. The **scoring** is not machine learning — it is a weighted
heuristic engine (`engines/risk-engine.js`) plus a composite feature score in
`ml-phishing-engine.js`. There is no trained model in this project. A trained risk-scoring model is
on the [roadmap](ROADMAP.md).
