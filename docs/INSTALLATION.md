# Installation Guide

## Requirements

- Node.js 20+
- PostgreSQL 16+
- Redis
- Google Chrome
- Git

---

## 1. Clone

```bash
git clone https://github.com/bharathi12-hub/CyberPunk-Detection-Tool.git
cd CyberPunk-Detection-Tool
```

---

## 2. Backend

Install dependencies:

```bash
cd backend
npm install
```

Configure environment variables:

```bash
cp .env.example .env
```

Then edit `.env` and set at least `DATABASE_URL` and `REDIS_URL`, plus any
threat-intelligence / AI keys you want to enable. The full list (with links to
where each key comes from) is documented in
[`backend/.env.example`](../backend/.env.example).

Create a PostgreSQL database (default name `cyberpunk`) and run the migrations:

```bash
npm run migrate
```

Start the API:

```bash
npm start
```

The backend runs on http://localhost:3000 by default.

---

## 3. Redis

Make sure Redis is running and reachable at the `REDIS_URL` set in your `.env`:

```bash
redis-server
```

---

## 4. Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load Unpacked**
4. Select the `extension/` folder

---

## 5. Verify

Visit any site (for example https://example.com). The CyberPunk popup should
appear and show a Website Risk Score.
