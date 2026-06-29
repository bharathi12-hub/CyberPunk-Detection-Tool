export function calculateMLScore(features) {

  let score = 0;

  if(features.ipAddress)
    score += 20;

  if(features.shortener)
    score += 20;

  if(features.loginForm)
    score += 15;

  if(features.youngDomain)
    score += 20;

  if(features.typosquatting)
    score += 25;

  return Math.min(score,100);

}