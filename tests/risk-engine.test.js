import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../extension/engines/risk-engine.js';

describe('calculateRiskScore', () => {
  it('returns a perfect score for empty input (all engines default to safe)', () => {
    const r = calculateRiskScore({});
    expect(r.finalScore).toBe(100);
    expect(r.classification).toBe('LOW RISK');
  });

  it('scores a clean site as LOW RISK', () => {
    const r = calculateRiskScore({
      reputation: { trustScore: 95 },
      phishing: { confidence: 5 },
      tracker: { privacyScore: 90 },
      headers: { securityHeadersScore: 100 },
    });
    expect(r.finalScore).toBeGreaterThanOrEqual(80);
    expect(r.classification).toBe('LOW RISK');
  });

  it('scores a hostile site (bad reputation + phishing + scam signals) as HIGH RISK', () => {
    const r = calculateRiskScore({
      reputation: { trustScore: 10 },
      phishing: { confidence: 90 },
      tracker: { privacyScore: 20 },
      headers: { securityHeadersScore: 30 },
      typoResults: [{ suspected: 'g00gle.com' }],
      cryptoResults: [{ term: 'double your ETH' }],
      qrDetected: true,
    });
    expect(r.finalScore).toBeLessThan(50);
    expect(r.classification).toBe('HIGH RISK');
  });

  it('falls into MEDIUM RISK for a middling site', () => {
    const r = calculateRiskScore({
      reputation: { trustScore: 50 },
      phishing: { confidence: 50 },
    });
    expect(r.classification).toBe('MEDIUM RISK');
    expect(r.finalScore).toBeGreaterThanOrEqual(50);
    expect(r.finalScore).toBeLessThan(80);
  });

  it('derives the cookie score from the flagged/total ratio', () => {
    const r = calculateRiskScore({ cookies: { totalCookies: 10, flaggedCookies: 5 } });
    expect(r.breakdown.cookieScore).toBe(50);
  });

  it('penalizes a high-risk permission request', () => {
    const r = calculateRiskScore({ permissions: [{ riskLevel: 'High' }] });
    expect(r.breakdown.permissionsScore).toBe(85);
  });

  it('always clamps the final score to the 0..100 range', () => {
    const worst = calculateRiskScore({
      reputation: { trustScore: 0 },
      phishing: { confidence: 100 },
      tracker: { privacyScore: 0 },
      headers: { securityHeadersScore: 0 },
      typoResults: [1, 2, 3],
      cryptoResults: [1, 2, 3],
      qrDetected: true,
      forms: { flaggedForms: [1, 2, 3, 4, 5] },
    });
    expect(worst.finalScore).toBeGreaterThanOrEqual(0);
    expect(worst.finalScore).toBeLessThanOrEqual(100);
  });
});
