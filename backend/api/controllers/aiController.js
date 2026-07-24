/**
 * AI Controller
 * Calls the Anthropic API (Claude) to turn structured scan data into
 * plain-English security explanations. The model is given ONLY the
 * structured scan JSON — never raw page content or credentials — to
 * minimize what's exposed to the LLM call.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

async function callClaude(systemPrompt, userContent) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

export async function explainRisk(req, res) {
  const { scan } = req.body;
  if (!scan) return res.status(400).json({ error: 'Missing scan data' });

  try {
    const explanation = await callClaude(
      'You are a browser security assistant. Given structured website scan data as JSON, ' +
        'write a concise 2-4 sentence plain-English explanation of the site\'s safety, ' +
        'in the style of: "Trust Score: 88/100. HTTPS enabled. Domain registered 8 years ago. ' +
        'No phishing indicators detected. 3 trackers found. Overall Risk: Low." ' +
        'Be factual and only state what the data supports. Do not add speculation.',
      JSON.stringify(scan)
    );
    res.json({ explanation });
  } catch (err) {
    console.error('explainRisk AI error:', err);
    res.status(500).json({ error: 'AI explanation unavailable' });
  }
}

export async function explainPhishing(req, res) {
  const { phishingResult, formResult } = req.body;
  if (!phishingResult) return res.status(400).json({ error: 'Missing phishingResult' });

  try {
    const explanation = await callClaude(
      'You are a browser security assistant. Given phishing-detection data as JSON, explain in ' +
        '1-3 sentences why a page was or was not flagged as a potential phishing site. Be specific ' +
        'about the actual reasons in the data (homograph attack, brand impersonation, suspicious form action, etc).',
      JSON.stringify({ phishingResult, formResult })
    );
    res.json({ explanation });
  } catch (err) {
    console.error('explainPhishing AI error:', err);
    res.status(500).json({ error: 'AI explanation unavailable' });
  }
}
