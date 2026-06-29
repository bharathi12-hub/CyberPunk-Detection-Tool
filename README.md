# CyberPunk Detection Tool

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-orange)
![Node.js](https://img.shields.io/badge/Backend-NodeJS-brightgreen)

---

## Overview

CyberPunk Detection Tool is an AI-powered browser security extension that analyzes websites in real time and generates an explainable security trust score.

Unlike traditional URL reputation tools, CyberPunk combines multiple security engines including phishing detection, tracker analysis, cookie inspection, security headers, threat intelligence feeds, and machine learning–based risk analysis into a single platform.

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
backend/
extension/
docs/
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
git clone https://github.com/YOUR_USERNAME/CyberPunk-Detection-Tool.git

cd CyberPunk-Detection-Tool
```

### Backend

```bash
cd backend
npm install
npm start
```

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

![Dashboard](screenshots/dashboard.png)

### Popup

![Popup](screenshots/popup.png)

### Reports

![Reports](screenshots/reports.png)

### History

![History](screenshots/history.png)

### Settings

![Settings](screenshots/settings.png)

---

## Future Improvements

- LLM-based AI explanation
- RAG integration
- Sandbox URL execution
- SIEM integration
- Docker deployment
- Kubernetes deployment
- Firefox Extension
- Edge Extension

---

## Author

Bharathithasan S

BE Computer Science (Cyber Security)
