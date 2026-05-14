const axios = require('axios');

/**
 * 3-strategy JSON parser for AI responses.
 */
function parseAIJson(text) {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (e) {}
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }
  return null;
}

async function generateAIResponse(systemPrompt, userPrompt) {
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === 'your-openrouter-key-here' || apiKey === 'your_openrouter_key_here') {
    return 'AI service unavailable — OPENROUTER_API_KEY not configured.';
  }

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Crisis Communication Agent',
        },
        timeout: 60000,
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    throw new Error('AI generation failed: ' + (error.response?.data?.error?.message || error.message));
  }
}

/**
 * Like generateAIResponse but always tries to parse the response as JSON
 * and returns { raw, parsed } where parsed may be null if non-JSON.
 */
async function generateAIJson(systemPrompt, userPrompt) {
  const raw = await generateAIResponse(systemPrompt, userPrompt);
  return { raw, parsed: parseAIJson(raw) };
}

module.exports = { generateAIResponse, generateAIJson, parseAIJson };
