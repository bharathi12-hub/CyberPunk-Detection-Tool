/**
 * AI Report Generator
 * Produces a structured, shareable security report for a scanned site —
 * used by the dashboard's "Export Report" feature and by backend/analytics
 * for historical record-keeping.
 */

export function buildReport(scan) {
  const {
    reputation, phishing, tracker, fingerprint, headers, cookies, permissions,
    downloads, forms, risk, typoResults, cryptoResults, mlScore, qrDetected,
  } = scan;

  return {
    generatedAt: new Date().toISOString(),
    url: reputation.url,
    hostname: reputation.hostname,
    overallRisk: risk.classification,
    trustScore: risk.finalScore,
    sections: [
      {
        title: 'Reputation',
        score: reputation.trustScore,
        details: [
          `HTTPS: ${reputation.https ? 'Enabled' : 'Disabled'}`,
          `Domain Age: ${reputation.domainAge ?? 'Unknown'} year(s)`,
          `Threat Feeds: ${reputation.threatFeedClean ? 'Clean' : 'Listed (' + reputation.threatFeedSources.join(', ') + ')'}`,
          `Redirects: ${reputation.redirectCount}`,
        ],
      },
      {
        title: 'Phishing Analysis',
        score: 100 - phishing.confidence,
        details: phishing.isPotentialPhishing
          ? [`Potential Phishing Site — Confidence: ${phishing.confidence}%`, ...phishing.reasons]
          : ['No phishing indicators detected'],
      },
      {
        title: 'Typosquatting',
        details: typoResults?.length
          ? typoResults.map((t) => `${t.issue} (severity: ${t.severity})`)
          : ['No typosquatting indicators detected'],
      },
      {
        title: 'Crypto Scam Language',
        details: cryptoResults?.length
          ? [`Suspicious phrase(s) found on page: ${cryptoResults.join(', ')}`]
          : ['No crypto-scam language detected on page'],
      },
      {
        title: 'ML Risk Signal',
        details: [`Composite ML risk score: ${mlScore ?? 0}/100${mlScore >= 50 ? ' — elevated' : ''}`],
      },
      {
        title: 'QR Code',
        details: [qrDetected ? 'QR code image detected on page — verify destination before scanning' : 'No QR code detected on page'],
      },
      {
        title: 'Trackers & Privacy',
        score: tracker.privacyScore,
        details: [
          `Trackers Found: ${tracker.trackersFound}`,
          ...tracker.trackers.map((t) => `${t.name} (${t.hits} request(s))`),
        ],
      },
      {
        title: 'Security Headers',
        score: headers.securityHeadersScore,
        details: [
          `Security Headers Score: ${headers.securityHeadersScore}/100`,
          ...headers.missing.map((m) => `Missing: ${m.label}`),
        ],
      },
      {
        title: 'Cookies',
        score: cookies.totalCookies ? Math.round(100 * (1 - cookies.flaggedCookies / cookies.totalCookies)) : 100,
        details: cookies.cookies.filter((c) => c.hasRisk).map((c) => c.summary),
      },
      {
        title: 'Permissions',
        details: permissions.map((p) => p.message),
      },
      {
        title: 'Downloads',
        details: downloads.map((d) => `${d.filename}: ${d.riskLevel}`),
      },
      {
        title: 'Fingerprinting',
        details: fingerprint?.fingerprintingDetected
          ? fingerprint.techniques.map((t) => t.technique)
          : ['No fingerprinting attempts detected'],
      },
      {
        title: 'Forms & Data Leakage',
        details: [
          ...(forms?.flaggedForms || []).map((f) => `Suspicious form: submits to ${f.actionHostname}`),
          ...(forms?.sensitiveData?.findings || []).map((f) => `Sensitive data pattern detected: ${f.type}`),
        ],
      },
    ],
  };
}

/**
 * Renders the structured report as plain text (for copy/export).
 */
export function renderReportAsText(report) {
  let out = `Security Report for ${report.hostname}\n`;
  out += `Generated: ${report.generatedAt}\n`;
  out += `Overall Risk: ${report.overallRisk} (${report.trustScore}/100)\n`;
  out += `Note: The Score is only for Reference not a Guarantee.\n\n`;

  for (const section of report.sections) {
    out += `## ${section.title}${section.score !== undefined ? ` — ${section.score}/100` : ''}\n`;
    for (const detail of section.details) {
      out += `  - ${detail}\n`;
    }
    out += '\n';
  }

  return out;
}

/**
 * Combines multiple reports into a single text document — used by the
 * dashboard's "Export All Reports" bulk action. Each report is separated
 * by a divider so it remains readable as one continuous file.
 */
export function renderCombinedReportsAsText(reports) {
  const divider = '\n' + '='.repeat(60) + '\n\n';
  return reports.map(renderReportAsText).join(divider);
}

/**
 * Exports a single report (or combined text) as a downloadable PDF using
 * the vendored jsPDF library. Wraps long lines so nothing gets clipped off
 * the page edge.
 * @param {string} text - plain text content (from renderReportAsText or renderCombinedReportsAsText)
 * @param {string} filename - e.g. "security-report.pdf"
 */
export async function exportAsPdf(text, filename) {
  const { jsPDF } = await import('../vendor/jspdf.es.min.js');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const marginLeft = 40;
  const marginTop = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginLeft * 2;
  const lineHeight = 14;

  let y = marginTop;
  const lines = text.split('\n');

  doc.setFont('helvetica', 'normal');

  for (const rawLine of lines) {
    let line = rawLine;
    let isHeading = false;

    if (line.startsWith('## ')) {
      isHeading = true;
      line = line.slice(3);
    }

    doc.setFontSize(isHeading ? 13 : 10);
    doc.setFont('helvetica', isHeading ? 'bold' : 'normal');

    const wrapped = doc.splitTextToSize(line || ' ', maxWidth);
    for (const wrappedLine of wrapped) {
      if (y > pageHeight - marginTop) {
        doc.addPage();
        y = marginTop;
      }
      doc.text(wrappedLine, marginLeft, y);
      y += lineHeight;
    }
    if (isHeading) y += 4; // extra breathing room after section headers
  }

  // Use output('blob') + a manual anchor-click download instead of jsPDF's
  // built-in .save(), which contains legacy-browser fallback logic (including
  // a window.open() path) that can silently fail or get popup-blocked in some
  // contexts. This matches exportAsDocx's proven, predictable download pattern.
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exports a single report (or combined text) as a downloadable DOCX using
 * the vendored minimal docx-builder.
 * @param {string} text - plain text content (from renderReportAsText or renderCombinedReportsAsText)
 * @param {string} title - document title shown at the top of the file
 * @param {string} filename - e.g. "security-report.docx"
 */
export async function exportAsDocx(text, title, filename) {
  const { buildDocx } = await import('../vendor/docx-builder.js');
  const bytes = buildDocx(title, text);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
