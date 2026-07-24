# FAQ

### Does CyberPunk block websites?

No. It analyzes pages and reports risk — it never blocks, redirects, or interrupts browsing.

### Do I need the backend to use it?

No. The extension is fully functional standalone: every engine, the keyless threat feeds, scoring,
theming, and report export work with no server. The backend adds persistent history, aggregate
analytics, AI explanations, and the three key-gated feeds.

### Do I need API keys?

No. Everything in the table under [THREAT-INTELLIGENCE.md](THREAT-INTELLIGENCE.md#keyless-feeds--run-in-the-browser)
is free and keyless. Optional keys (Anthropic, VirusTotal, AbuseIPDB, Safe Browsing) each unlock one
extra feature and degrade gracefully when absent.

### Does it use AI?

Yes — for **explanations**. Scan results are sent to Anthropic Claude (`claude-sonnet-5`) to generate
a plain-English summary, with a local rule-based fallback if the key is missing or the call times
out. The **scoring itself is not AI** — it's a weighted heuristic engine. See
[AI-SYSTEM.md](AI-SYSTEM.md).

### Is my browsing history collected?

Scan results are stored locally, and in your own PostgreSQL database if you run the backend. Nothing
goes to any third party you haven't enabled a key for, and nothing is ever sold or shared. Retention
is configurable in Settings. Full details in [`../PRIVACY.md`](../PRIVACY.md).

### What exactly gets sent to the AI?

Only the structured scan JSON — scores, counts, booleans, hostname. Never raw page content, form
values, or credentials.

### Is the trust score guaranteed?

No. **The score is only for reference, not a guarantee.** Detection is heuristic, so false positives
and false negatives are both possible.

### Can I export reports?

Yes — `.txt`, `.pdf`, and `.docx`, individually or as a bulk "Export All Reports". Export is fully
client-side; no data leaves your browser to produce a report.

### Why does it need access to all sites?

The tool scores whichever page you're currently viewing, so `<all_urls>` host permission is
unavoidable. Analysis runs locally in your browser.

### Why is the domain age sometimes missing?

Domain age comes from RDAP, whose free endpoint rate-limits to roughly 10 requests per 10 seconds.
Results are cached per hostname for 7 days, and a rate-limited lookup is reported distinctly from a
genuinely unavailable one.

### Which browsers are supported?

Chrome (and Chromium-based browsers) via Manifest V3. Firefox and Edge builds are on the
[roadmap](ROADMAP.md).

### How do I run the tests?

```bash
npm install
npm test
```

See [CONTRIBUTING.md](../CONTRIBUTING.md).
