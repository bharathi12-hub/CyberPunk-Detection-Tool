# Database Schema

PostgreSQL. The schema is created idempotently by `backend/postgres/migrate.js`:

```bash
cd backend && npm run migrate
```

Connection uses a single `DATABASE_URL` connection string (see `backend/.env.example`) through a
shared `pg.Pool` in `backend/postgres/db.js`.

---

## `scans`

Every stored scan. The complete scan object is also kept verbatim in `raw_scan` (JSONB) so the
dashboard can still render historical scans if the extension's payload shape evolves.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `SERIAL PRIMARY KEY` | Returned to clients as `_id` |
| `url` | `TEXT NOT NULL` | |
| `hostname` | `TEXT NOT NULL` | Indexed |
| `trust_score` | `INTEGER NOT NULL` | 0–100 |
| `classification` | `TEXT NOT NULL` | `LOW RISK` / `MEDIUM RISK` / `HIGH RISK` |
| `https_enabled` | `BOOLEAN` | |
| `domain_age_years` | `NUMERIC` | |
| `phishing_confidence` | `INTEGER` | |
| `trackers_found` | `INTEGER` | |
| `headers_score` | `INTEGER` | |
| `cookies_flagged` | `INTEGER` | |
| `cookies_total` | `INTEGER` | |
| `raw_scan` | `JSONB NOT NULL` | Full scan payload |
| `scanned_at` | `TIMESTAMPTZ NOT NULL` | Defaults to `now()` |

Indexes: `idx_scans_hostname (hostname)` and `idx_scans_scanned_at (scanned_at DESC)`.

---

## `threat_statistics`

Per-hostname running aggregate, upserted on every `POST /api/scans` via
`ON CONFLICT (hostname) DO UPDATE`.

| Column | Type |
| --- | --- |
| `id` | `SERIAL PRIMARY KEY` |
| `hostname` | `TEXT NOT NULL UNIQUE` |
| `total_scans` | `INTEGER NOT NULL DEFAULT 0` |
| `high_risk_count` | `INTEGER NOT NULL DEFAULT 0` |
| `phishing_flag_count` | `INTEGER NOT NULL DEFAULT 0` |
| `last_scanned_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

---

## `user_preferences`

| Column | Type |
| --- | --- |
| `id` | `SERIAL PRIMARY KEY` |
| `client_id` | `TEXT NOT NULL UNIQUE` |
| `notify_high_risk` | `BOOLEAN NOT NULL DEFAULT true` |
| `notify_downloads` | `BOOLEAN NOT NULL DEFAULT true` |
| `block_trackers` | `BOOLEAN NOT NULL DEFAULT false` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

---

## `security_reports`

| Column | Type |
| --- | --- |
| `id` | `SERIAL PRIMARY KEY` |
| `hostname` | `TEXT NOT NULL` |
| `report` | `JSONB NOT NULL` |
| `generated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

---

## Notes

- **There is no `users` table and no credential storage.** The tool is single-user / self-hosted;
  `user_preferences.client_id` identifies an extension install, not an authenticated account.
- All queries are **parameterized** (`$1, $2, …`) — no string-concatenated SQL anywhere.
- Redis is a cache only. Nothing stored in Redis is authoritative, and the backend works without it.
