# Privacy Policy — CyberPunk Detection Tool

_Last updated: 2026_

CyberPunk Detection Tool is a browser security extension. This document explains what data
it handles and where that data goes.

## What the extension processes

To score the safety of a page, the extension inspects the **page you are currently viewing**:

- The page URL and hostname
- Security headers, cookie metadata (names/flags — **not** values), and tracker requests
- Page form structure and text signals used for phishing / crypto-scam heuristics

This analysis happens **locally in your browser**.

## What is stored

- **Scan results and history** are stored locally, and — if you run the optional backend —
  in **your own** PostgreSQL database. You control retention from the extension's Options page.
- Nothing is sold or shared with advertisers.

## What is sent to third parties

Only when the corresponding feature / API key is enabled:

| Destination                        | Data sent                                              | Purpose                     |
| ---------------------------------- | ------------------------------------------------------ | --------------------------- |
| Your own backend                   | Structured scan JSON                                   | Storage, analytics, AI      |
| Anthropic (Claude)                 | Structured scan JSON (no raw page content/credentials) | Plain-English risk summary  |
| VirusTotal / Google Safe Browsing  | The URL being checked                                  | URL reputation              |
| AbuseIPDB                          | The resolved IP address                                | IP reputation               |

The backend is meant to be **self-hosted** by you, using **your own** API keys.

## What is never collected

- Passwords or form values you type
- Full page content sent to any third party
- Personal identifiers beyond the above

## Contact

Questions? Open an issue on the repository.
