const SCAM_WORDS = [

  "double your bitcoin",
  "free crypto",
  "airdrop",
  "send btc",
  "guaranteed profit",
  "instant return"

];

export function detectCryptoScam(text) {

  const findings = [];

  const lower = (text || '').toLowerCase();

  SCAM_WORDS.forEach(word => {

    if(lower.includes(word)) {

      findings.push(word);

    }

  });

  return findings;

}