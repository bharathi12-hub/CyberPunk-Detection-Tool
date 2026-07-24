# Contributing

Thanks for your interest in improving CyberPunk Detection Tool!

## Project layout

- `extension/` — Chrome MV3 extension (popup, dashboard, engines, content scripts)
- `backend/` — Node.js + Express API (PostgreSQL + Redis)
- `docs/` — documentation (start with [docs/GUIDE.md](docs/GUIDE.md))
- `tests/` — unit tests for the detection engines

## Getting started

```bash
# install dev tooling + run the engine tests
npm install
npm test

# lint the backend + tests
npm run lint
```

Run the backend (see [docs/INSTALLATION.md](docs/INSTALLATION.md) for DB/Redis setup):

```bash
cd backend && npm install && cp .env.example .env && npm run migrate && npm start
```

…or bring the whole backend stack up with Docker:

```bash
docker compose up --build
```

## Pull requests

1. Branch off `main` (`feature/...` or `fix/...`).
2. Keep changes focused; add or update tests in `tests/` for engine logic.
3. Make sure `npm test` and `npm run lint` pass.
4. Open a PR with a clear description of the change.
