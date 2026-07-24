# Deployment

## Docker (recommended)

`docker-compose.yml` in the repository root brings up the whole backend stack — API, PostgreSQL, and
Redis — in one command:

```bash
docker compose up --build
```

This starts three services:

| Service | Image | Port |
| --- | --- | --- |
| `api` | built from `backend/Dockerfile` | 3000 |
| `db` | `postgres:16-alpine` | 5432 |
| `redis` | `redis:7-alpine` | 6379 |

The `api` service waits for Postgres to pass its healthcheck, runs `node postgres/migrate.js` to
apply the schema, then starts the server. Postgres data persists in the `pgdata` volume.

Bring up a single service if needed:

```bash
docker compose up db
docker compose up redis
```

Tear down (add `-v` to also drop the database volume):

```bash
docker compose down
```

### API keys under Docker

Threat-intel and AI keys are optional and read from your shell environment:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export VIRUSTOTAL_API_KEY=...
docker compose up --build
```

Anything unset is simply passed through empty, and that feature reports
`no_api_key_configured` rather than failing the stack.

---

## Manual deployment

```bash
cd backend
npm ci
cp .env.example .env      # then fill in DATABASE_URL and REDIS_URL
npm run migrate
npm start
```

Requires reachable PostgreSQL 16+ and Redis instances. Full steps are in
[INSTALLATION.md](INSTALLATION.md).

---

## The extension

The extension is **not** deployed to a server — it is loaded per browser. See
[CHROME-EXTENSION.md](CHROME-EXTENSION.md). If your backend is not on `localhost:3000`, update the
backend URL the extension calls before loading it.

---

## Before exposing the backend publicly

The API ships with **no authentication** and permissive CORS. At minimum:

1. Set `ALLOWED_ORIGIN` to your actual extension/dashboard origin instead of `*`.
2. Put the API behind an auth layer or a reverse proxy with access control.
3. Tune the rate limit in `backend/api/server.js` (default: 120 req/min globally).

Otherwise anyone who can reach the host can consume your Anthropic, VirusTotal, and AbuseIPDB
quotas. See [`../SECURITY.md`](../SECURITY.md).
