/**
 * AI Gateway Module
 * =================
 * Axiom: All LLM communication flows through a single abstraction.
 * No module calls the AI API directly. This is the only HTTP boundary.
 *
 * Contract: Takes messages array + config, returns completion string.
 * Supports multiple models for twin diversity (Axiom A4 mitigation).
 */

const GATEWAY_URL = 'https://ai-gateway.happycapy.ai/api/v1/chat/completions';

const AVAILABLE_MODELS = [
  'google/gemini-3-flash-preview',
  'google/gemini-3-pro-preview',
];

/**
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {string} [options.model='anthropic/claude-sonnet-4-6']
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=2048]
 * @returns {Promise<string>} The assistant's response text
 */
export async function complete({ messages, model = 'google/gemini-3-flash-preview', temperature = 0.7, maxTokens = 2048 }) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error('AI_GATEWAY_API_KEY not set in environment');

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI Gateway error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Run a chat completion that returns structured JSON.
 * Wraps the prompt to instruct JSON-only output.
 */
export async function completeJSON({ messages, model, temperature = 0.4, maxTokens = 4096 }) {
  const jsonMessages = [
    ...messages.slice(0, -1),
    {
      role: messages[messages.length - 1].role,
      content: messages[messages.length - 1].content + '\n\nRespond ONLY with valid JSON. No markdown, no explanation, no code fences.',
    },
  ];

  const raw = await complete({ messages: jsonMessages, model, temperature, maxTokens });
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Run multiple completions in parallel with concurrency control.
 * @param {Array<Object>} requests - Array of complete() option objects
 * @param {number} [concurrency=10] - Max parallel requests
 * @returns {Promise<string[]>} Array of response texts
 */
export async function completeBatch(requests, concurrency = 10) {
  const results = [];
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(req => complete(req)));
    results.push(...batchResults);
  }
  return results;
}

/** Get a random model for twin diversity */
export function randomModel() {
  return AVAILABLE_MODELS[Math.floor(Math.random() * AVAILABLE_MODELS.length)];
}

export { AVAILABLE_MODELS };
