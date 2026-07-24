# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via GitHub **Security → Advisories → Report a vulnerability**, or
email the maintainer. You can expect an initial response within a few days.

## Deployment notes

The backend API is intended for **local / self-hosted** use. Before exposing it publicly:

- It ships with permissive CORS (`ALLOWED_ORIGIN=*`) and **no authentication**. Restrict
  `ALLOWED_ORIGIN` and put the API behind an auth layer (API key, reverse proxy, etc.),
  otherwise anyone who can reach it can consume your Anthropic / VirusTotal / AbuseIPDB
  quotas.
- Secrets are provided via `.env` (see [`backend/.env.example`](backend/.env.example)) and
  must never be committed.
- A global rate limit is enabled in `backend/api/server.js`; tune it for your deployment.
