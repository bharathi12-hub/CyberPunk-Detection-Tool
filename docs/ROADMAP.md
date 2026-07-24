# Roadmap

## Shipped — v1.0

- ✅ Chrome MV3 extension (popup, dashboard, options)
- ✅ 13 detection engines + weighted risk scoring
- ✅ Threat-intelligence integration (6 feeds, keyless + key-gated)
- ✅ AI risk & phishing explanations with local fallback
- ✅ Scan history, search, per-row and bulk delete, retention policy
- ✅ Report export — `.txt` / `.pdf` / `.docx`, single and bulk
- ✅ 5 themes × dark/light, applied live across all surfaces
- ✅ Node.js + Express backend with PostgreSQL and Redis
- ✅ Unit tests for the risk engine (Vitest) + GitHub Actions CI
- ✅ Docker Compose stack (API + PostgreSQL + Redis)

## Known gaps in v1.0

Two settings persist your preference but are not yet wired to behavior — flagged honestly rather
than faked:

- **Auto-block known trackers** — needs a `declarativeNetRequest` rule set
- **Risk sensitivity** — needs threshold tuning in `risk-engine.js`

## Next — v1.1

- Wire up the two settings above
- Backend API authentication (API key) and a tightened CORS default
- Integration tests for the API layer (`supertest`)
- Automated dependency vulnerability scanning in CI
- Expand lint coverage to the extension source

## Later — v2

- Trained risk-scoring model to replace the composite heuristic
- RAG over threat-intelligence corpora for richer explanations
- MITRE ATT&CK mapping for detected techniques
- Real SSL/TLS certificate inspection
- SIEM integration (export scans as CEF/JSON for Splunk, Elastic)
- Live dashboard updates over WebSocket

## Exploratory — v3

- Firefox and Edge builds
- Kubernetes deployment manifests
- Team / multi-user mode with real accounts and RBAC
- Sandboxed URL detonation
- Mobile companion

Detailed upgrade notes live in [UPGRADES.md](UPGRADES.md).
