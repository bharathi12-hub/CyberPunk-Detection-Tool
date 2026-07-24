# CyberPunk Detection Tool

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-orange)
![Node.js](https://img.shields.io/badge/Backend-NodeJS-brightgreen)
[![CI](https://github.com/bharathi12-hub/CyberPunk-Detection-Tool/actions/workflows/ci.yml/badge.svg)](https://github.com/bharathi12-hub/CyberPunk-Detection-Tool/actions/workflows/ci.yml)

---

## Overview

CyberPunk Detection Tool is an AI-powered browser security extension that analyzes websites in real time and generates an explainable security trust score.

Unlike traditional URL reputation tools, CyberPunk combines multiple security engines including phishing detection, tracker analysis, cookie inspection, security headers, threat intelligence feeds, and a weighted heuristic risk engine into a single platform.

---

## Features

- Real-time Website Risk Analysis
- AI-generated Security Summary
- Trust Score (0–100)
- URL Reputation Analysis
- Phishing Detection
- Typosquatting Detection
- Tracker Detection
- Cookie Security Inspection
- Security Headers Analysis
- Browser Fingerprinting Detection
- Crypto Scam Detection
- QR Code Detection
- Download Risk Analysis
- Scan History Dashboard
- PDF/DOCX/TXT Report Export
- PostgreSQL Storage
- Redis Cache
- Threat Intelligence Integration

---

## Architecture

```
Browser
      │
Chrome Extension
      │
Detection Engines
      │
Threat Intelligence
      │
Risk Engine
      │
AI Explanation
      │
Dashboard
      │
Backend API
      │
PostgreSQL
      │
Redis
```

---

## Project Structure

```
backend/            # Node.js + Express API (PostgreSQL + Redis)
extension/          # Chrome MV3 extension (popup, dashboard, engines)
tests/              # Engine unit tests (Vitest)
docs/               # Documentation (start with docs/GUIDE.md)
docker-compose.yml  # One-command backend stack (API + Postgres + Redis)
```

---

## Technologies

Frontend

- HTML
- CSS
- JavaScript

Backend

- Node.js
- Express

Database

- PostgreSQL
- Redis

Threat Intelligence

- OpenPhish
- PhishTank
- URLHaus
- Google Safe Browsing
- VirusTotal
- AbuseIPDB

---

## Dashboard

- Risk Statistics
- Scan History
- Reports
- Settings
- Analytics

---

## Detection Modules

- Reputation Engine
- Cookie Engine
- CSP Analysis
- Header Analysis
- Permission Analysis
- Download Analysis
- Tracker Analysis
- Fingerprint Analysis
- Crypto Scam Engine
- Risk Engine
- AI Risk Explainer

---

## Installation

### Clone

```bash
git clone https://github.com/bharathi12-hub/CyberPunk-Detection-Tool.git
cd CyberPunk-Detection-Tool
```

### Backend

```bash
cd backend
npm install

# Configure environment (Postgres, Redis, and optional API keys)
cp .env.example .env
# ...then edit .env and fill in the values

# Create the database tables
npm run migrate

# Start the API on http://localhost:3000
npm start
```

> Requires PostgreSQL and Redis running locally (or reachable via the URLs in `.env`).
> See [docs/INSTALLATION.md](docs/INSTALLATION.md) for full setup details.

### Run with Docker (quickest)

Bring up the API, PostgreSQL, and Redis together:

```bash
docker compose up --build
```

The API is then available at http://localhost:3000. Threat-intel / AI keys are optional —
export them in your shell (or a root `.env`) to enable those features.

### Extension

```
Chrome

Extensions

Developer Mode

Load Unpacked

Select extension/
```

---

## Screenshots

### Dashboard

<img width="1896" height="1037" alt="1" src="https://github.com/user-attachments/assets/3d83842a-5c47-404b-8da7-8abcda87d239" />


### Popup

<img width="1918" height="1078" alt="Screenshot 2026-06-29 091852" src="https://github.com/user-attachments/assets/4a5c32ac-8da8-41ea-8cda-4d0c75af5a87" />


### Reports

<img width="1918" height="1021" alt="Screenshot 2026-06-29 091704" src="https://github.com/user-attachments/assets/91c45887-8d16-486b-a434-736de426a8b1" />


### History

<img width="1896" height="1032" alt="2" src="https://github.com/user-attachments/assets/da7915ce-fd02-4cfd-ac6f-2f57c6b4e136" />


### Settings

<img width="1297" height="1027" alt="5" src="https://github.com/user-attachments/assets/269ee1ff-ef6f-482f-abbd-e92102ccb224" />

<img width="1172" height="1020" alt="Screenshot 2026-06-29 091815" src="https://github.com/user-attachments/assets/3b156e22-69d4-4368-8ca7-20113f79ec5a" />



---

## Testing

Detection-engine logic is covered by unit tests (Vitest):

```bash
npm install   # root dev tooling
npm test      # run the engine test suite
npm run lint  # lint backend + tests
```

CI runs the tests and linter on every push via GitHub Actions.

---

## Security & Privacy

- **Security policy:** [SECURITY.md](SECURITY.md) — the backend is intended for local / self-hosted use; restrict CORS and add auth before exposing it publicly.
- **Privacy:** [PRIVACY.md](PRIVACY.md) — page analysis happens locally; only structured data is sent to the services you enable.
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Future Improvements

- LLM-based AI explanation
- RAG integration
- Sandbox URL execution
- SIEM integration
- Kubernetes deployment
- Firefox Extension
- Edge Extension

---

## Author

Bharathithasan S

BE Computer Science (Cyber Security)
