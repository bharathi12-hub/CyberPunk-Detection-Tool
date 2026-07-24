/**
 * Content Script: QR Code Image Scanner
 * Scans visible <img> elements for filenames/alt-text suggesting a QR code.
 * QR codes embedded in webpages are a known phishing vector ("quishing") —
 * scanning a QR code can route victims to a credential-harvesting page that
 * never appears as a clickable link for URL-based filters to catch.
 *
 * NOTE: This is a heuristic (filename/alt-text match), not actual image
 * decoding — true QR decoding would require pulling in a image-processing
 * library and decoding pixel data, which is a heavier follow-up feature.
 * This heuristic catches the common case where a QR image is named/labeled
 * descriptively, and reports a finding to background-worker for risk scoring.
 */

function safeSendMessage(message) {
  if (!chrome?.runtime?.id) return; // extension context invalidated (e.g. reload while this tab was open) — nothing to send to
  try {
    chrome.runtime.sendMessage(message);
  } catch (err) {
    // swallow — the receiving end is gone, nothing more to do
  }
}

function scanForQrImages() {
  const images = document.querySelectorAll('img');

  images.forEach((img) => {
    const src = (img.src || '').toLowerCase();
    const alt = (img.alt || '').toLowerCase(); // guard against null/undefined alt

    if (src.includes('qrcode') || src.includes('qr-code') || src.includes('/qr/') || alt.includes('qr code') || alt.includes('scan to')) {
      safeSendMessage({
        type: 'QR_FOUND',
        src: img.src,
      });
    }
  });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  scanForQrImages();
} else {
  window.addEventListener('DOMContentLoaded', scanForQrImages);
}
