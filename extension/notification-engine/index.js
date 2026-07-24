/**
 * Notification Engine
 * Fires native Chrome notifications for high-risk findings: HIGH RISK site
 * scores, dangerous downloads, and (optionally) phishing form detection.
 */

let notificationCounter = 0;

function showNotification({ title, message, iconUrl = 'icons/icon128.png' }) {
  const id = `bsa-notification-${notificationCounter++}`;
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl,
    title,
    message,
    priority: 2,
  });
  return id;
}

export function notifyHighRisk(hostname, risk) {
  showNotification({
    title: '⚠️ High Risk Website Detected',
    message: `${hostname} scored ${risk.finalScore}/100 — ${risk.classification}. Review before entering any data.`,
  });
}

export function notifyDownloadRisk(downloadResult) {
  showNotification({
    title: '⚠️ High Risk Download',
    message: `"${downloadResult.filename}" — ${downloadResult.reasons[0] || 'flagged as high risk'}`,
  });
}

export function notifyPhishingForm(phishingResult) {
  showNotification({
    title: '🎯 Potential Phishing Form',
    message: `This page's login form looks suspicious (${phishingResult.confidence}% confidence). Avoid entering credentials.`,
  });
}

export function notifyPermissionAbuse(permissionResult) {
  showNotification({
    title: '🔒 Repeated Permission Request',
    message: permissionResult.message,
  });
}
