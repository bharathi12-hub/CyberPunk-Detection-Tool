/**
 * Tracker Engine
 * Detects: Google Analytics, Meta Pixel, Hotjar, Mixpanel, Segment, and more
 * Output: Trackers Found count, Privacy Score (0-100)
 */

// Domain/script signatures for known trackers. Matched against request URLs
// observed by the background-worker's webRequest listener.
const TRACKER_SIGNATURES = [
  { name: 'Google Analytics', pattern: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/ },
  { name: 'Meta Pixel', pattern: /connect\.facebook\.net|facebook\.com\/tr/ },
  { name: 'Hotjar', pattern: /hotjar\.com/ },
  { name: 'Mixpanel', pattern: /mixpanel\.com/ },
  { name: 'Segment', pattern: /segment\.io|segment\.com/ },
  { name: 'Amplitude', pattern: /amplitude\.com/ },
  { name: 'DoubleClick', pattern: /doubleclick\.net/ },
  { name: 'TikTok Pixel', pattern: /analytics\.tiktok\.com/ },
  { name: 'Hubspot', pattern: /hs-analytics\.net|hubspot\.com/ },
  { name: 'Crazy Egg', pattern: /crazyegg\.com/ },
  { name: 'Yandex Metrica', pattern: /mc\.yandex\.ru/ },
  { name: 'New Relic', pattern: /newrelic\.com|nr-data\.net/ },
  { name: 'Microsoft Clarity', pattern: /clarity\.ms/ },
  { name: 'FullStory', pattern: /fullstory\.com/ },
  { name: 'Taboola', pattern: /taboola\.com/ },
  { name: 'Outbrain', pattern: /outbrain\.com/ },
  { name: 'Criteo', pattern: /criteo\.com/ },
  { name: 'Quantcast', pattern: /quantserve\.com/ },
  { name: 'ScorecardResearch', pattern: /scorecardresearch\.com/ },
];

/**
 * Classifies a single outgoing request URL against known tracker signatures.
 * @param {string} requestUrl
 * @returns {string|null} tracker name if matched, else null
 */
export function classifyRequest(requestUrl) {
  for (const tracker of TRACKER_SIGNATURES) {
    if (tracker.pattern.test(requestUrl)) {
      return tracker.name;
    }
  }
  return null;
}

/**
 * Aggregates a list of request URLs observed on a page load into a
 * tracker report + privacy score.
 * @param {string[]} requestUrls - all network requests fired by the page
 */
export function analyzeTrackers(requestUrls = []) {
  const found = new Map(); // tracker name -> hit count

  for (const url of requestUrls) {
    const name = classifyRequest(url);
    if (name) {
      found.set(name, (found.get(name) || 0) + 1);
    }
  }

  const trackerList = Array.from(found.entries()).map(([name, hits]) => ({ name, hits }));
  const trackerCount = trackerList.length;

  // Privacy score: starts at 100, loses points per distinct tracker (diminishing penalty)
  let privacyScore = 100 - trackerCount * 8;
  privacyScore = Math.max(0, privacyScore);

  return {
    trackersFound: trackerCount,
    trackers: trackerList,
    privacyScore,
  };
}
