/**
 * Permission Engine
 * Monitors: Camera, Microphone, Clipboard, Location, Notifications
 * Output: Risk classification per permission request
 */

const PERMISSION_RISK = {
  camera: 'High',
  microphone: 'High',
  geolocation: 'Medium',
  notifications: 'Low',
  clipboardRead: 'Medium',
  clipboardWrite: 'Low',
  midi: 'Low',
  storage: 'Low',
};

const PERMISSION_LABELS = {
  camera: 'camera access',
  microphone: 'microphone access',
  geolocation: 'your location',
  notifications: 'permission to send notifications',
  clipboardRead: 'clipboard read access',
  clipboardWrite: 'clipboard write access',
};

/**
 * Tracks repeated permission requests from the same origin — a site asking
 * for the same permission multiple times after denial is itself a signal.
 */
const requestHistory = new Map(); // origin -> [{ permission, timestamp, granted }]

export function recordPermissionRequest(origin, permission, granted) {
  const history = requestHistory.get(origin) || [];
  history.push({ permission, timestamp: Date.now(), granted });
  requestHistory.set(origin, history);
}

/**
 * Main entry point. Called by content-script's permission API hooks
 * or background-worker's permissions.onAdded listener.
 * @param {string} origin
 * @param {string} permission - one of the keys in PERMISSION_RISK
 */
export function analyzePermissionRequest(origin, permission) {
  const risk = PERMISSION_RISK[permission] || 'Low';
  const label = PERMISSION_LABELS[permission] || permission;
  const history = requestHistory.get(origin) || [];

  const priorDenials = history.filter((h) => h.permission === permission && !h.granted).length;
  const repeatedAsk = priorDenials >= 1;

  return {
    origin,
    permission,
    riskLevel: repeatedAsk ? 'High' : risk,
    message: repeatedAsk
      ? `${origin} is requesting ${label} again after a previous denial`
      : `Website requested ${label}.`,
    repeatedAsk,
    priorDenials,
  };
}

export function getPermissionHistory(origin) {
  return requestHistory.get(origin) || [];
}
