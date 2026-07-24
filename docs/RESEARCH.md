# Research Notes

CyberPunk Detection Tool was built as a student research project in browser security and phishing
detection. This page records the problem framing, design rationale, and how the approach *would* be
evaluated — it does **not** report measured results, because no labelled benchmark has been run yet.

## Problem

Most URL-reputation tools return a single opaque verdict: "safe" or "dangerous". That has two
weaknesses:

1. **No explainability.** A user who is told a site is dangerous learns nothing about *why*, so they
   cannot make a judgement when the tool is wrong.
2. **Single-signal fragility.** Blocklists only catch URLs someone has already reported. Freshly
   registered phishing domains — the ones that matter most — are absent by definition.

## Approach

Combine many weak, independent signals into one explainable score rather than relying on any single
authority:

- **Multi-signal scoring.** Reputation, phishing heuristics, trackers, headers, cookies,
  permissions, and downloads are scored independently and combined with explicit weights
  ([DETECTION-ENGINES.md](DETECTION-ENGINES.md)). No single signal can dominate.
- **Explainability first.** The score always ships with its per-engine breakdown, and an LLM
  converts that structured breakdown into plain English — the explanation is *derived from* the
  score, never a substitute for it.
- **Blocklist-independent detection.** Homograph and combo-squat detection catch brand-impersonating
  domains that no feed has seen yet.
- **Graceful degradation.** Every external dependency is optional, so the tool keeps working when
  feeds are unavailable.

## Areas studied

- URL and domain analysis (homograph attacks, combo-squatting, shortener expansion, domain age)
- Phishing indicators in page structure (form actions, credential fields, brand cues)
- Browser fingerprinting techniques (canvas, audio, WebGL, fonts)
- HTTP security headers and cookie hardening
- Threat-intelligence aggregation and caching under strict free-tier rate limits
- Explainable AI for security decisions
- Multi-signal trust-score composition

## Planned evaluation methodology

Not yet performed. A meaningful evaluation would require a labelled corpus — e.g. confirmed phishing
URLs from PhishTank/OpenPhish paired with a benign sample from a top-sites list — and would measure:

| Metric | Why it matters here |
| --- | --- |
| Precision | False positives train users to ignore warnings |
| Recall | Missed phishing is the primary failure mode |
| F1 | Balance of the two |
| False-positive rate | The practical usability ceiling |
| Detection latency | Must stay well under page-interaction time |

Per-engine ablation would also be needed to justify the current weights, which are presently
reasoned rather than fitted.

## Honest limitations

- Weights in `risk-engine.js` are **hand-tuned, not learned**.
- Brand-impersonation detection is **name-based**, so it cannot catch a convincing phishing page on
  an unrelated domain that impersonates no known brand string.
- `ml-phishing-engine.js` is a **composite feature heuristic, not a trained model**.
- No labelled benchmark has been run, so no accuracy claims are made.

## Directions for future work

Trained classifiers over the existing feature vector, RAG over threat-intelligence corpora, graph
analysis of hosting/registration infrastructure, behavioural analysis of page scripts, and
real-time cross-user threat correlation.
