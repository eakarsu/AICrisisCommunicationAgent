const axios = require('axios');

async function generateAIResponse(systemPrompt, userPrompt) {
  try {
    const response = await axios.post(
      `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Crisis Communication Agent',
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    throw new Error('AI generation failed: ' + (error.response?.data?.error?.message || error.message));
  }
}

module.exports = { generateAIResponse };
