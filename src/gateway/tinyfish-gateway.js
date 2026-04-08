/**
 * TinyFish Gateway Module
 * =======================
 * Axiom: All TinyFish API communication flows through a single abstraction.
 * No module calls TinyFish directly. This is the only HTTP boundary.
 *
 * Uses the SSE streaming endpoint (/run-sse) as the primary transport.
 * Search and Fetch are routed through the Agent API as well, since
 * free-tier keys only have access to the Agent SSE endpoint.
 */

const AGENT_SSE_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse';

const DEFAULT_TIMEOUT = parseInt(process.env.TINYFISH_TIMEOUT || '120000', 10);
const DEFAULT_PROXY = process.env.TINYFISH_PROXY || 'US';

/** @type {number} */
let stepCount = 0;

/**
 * @returns {string} The TinyFish API key
 * @throws {Error} If TINYFISH_API_KEY is not set
 */
function getApiKey() {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error('TINYFISH_API_KEY not set in environment');
  return key;
}

/**
 * Parse SSE stream from TinyFish Agent API.
 * Reads the response body as text, extracts SSE data events,
 * and returns the COMPLETE event's result.
 *
 * @param {Response} res - fetch Response with SSE body
 * @param {number} timeout - max wait time ms
 * @returns {Promise<{result: any, runId: string, steps: number}>}
 */
async function parseSSEStream(res, timeout) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let runId = '';
  let result = null;
  let progressCount = 0;

  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete last line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      try {
        const event = JSON.parse(jsonStr);

        if (event.type === 'STARTED') {
          runId = event.run_id || '';
        } else if (event.type === 'PROGRESS') {
          progressCount++;
        } else if (event.type === 'COMPLETE') {
          result = event.result;
          runId = event.run_id || runId;
          reader.cancel();
          return { result, runId, steps: progressCount };
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Timeout or stream ended without COMPLETE
  reader.cancel();
  if (result) return { result, runId, steps: progressCount };
  throw new Error('TinyFish SSE stream ended without COMPLETE event');
}

/**
 * Scrape a URL using TinyFish Agent API with SSE streaming.
 * Endpoint: POST https://agent.tinyfish.ai/v1/automation/run-sse
 *
 * @param {string} url - Target URL to scrape
 * @param {string} goal - Natural language extraction goal
 * @param {Object} [options]
 * @param {number} [options.timeout] - Override timeout ms
 * @returns {Promise<{data: any, steps: number, runId: string}>}
 */
export async function agentScrape(url, goal, options = {}) {
  console.log(`[TinyFish] Agent scraping: ${url}`);

  const apiKey = getApiKey();
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  const body = {
    url,
    goal,
    proxy_config: { country_code: DEFAULT_PROXY },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(AGENT_SSE_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`TinyFish Agent API error (${res.status}): ${errText}`);
    }

    // Check if response is SSE stream or plain JSON
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const { result, runId, steps } = await parseSSEStream(res, timeout);
      stepCount += steps;
      return { data: result, steps, runId };
    }

    // Fallback: plain JSON response
    const response = await res.json();
    const steps = response.steps_taken || 0;
    stepCount += steps;
    return { data: response.data || response.result, steps, runId: response.run_id || '' };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`TinyFish request timed out after ${timeout}ms: ${url}`);
    }
    throw err;
  }
}

/**
 * Fetch and extract content from URLs using TinyFish Agent API.
 * Routes through the Agent SSE endpoint since Fetch API may not
 * be available on all API key tiers.
 *
 * @param {string[]} urls - Up to 10 URLs to fetch
 * @param {string} [format='markdown'] - Output format (used in goal)
 * @returns {Promise<Array<{url: string, title: string, text: string, description: string}>>}
 */
export async function fetchPages(urls, format = 'markdown') {
  console.log(`[TinyFish] Fetching ${urls.length} page(s): ${urls[0]}${urls.length > 1 ? ` +${urls.length - 1} more` : ''}`);

  const results = [];

  for (const url of urls) {
    try {
      const { data } = await agentScrape(
        url,
        `Extract the main content of this page as ${format}. Return JSON: { title: string, text: string (the main content as ${format}), description: string (a one-sentence summary) }`,
        { timeout: 90000 },
      );

      const parsed = typeof data === 'string' ? JSON.parse(data) : (data || {});
      results.push({
        url,
        title: parsed.title || '',
        text: parsed.text || parsed.content || JSON.stringify(parsed),
        description: parsed.description || '',
      });
    } catch (err) {
      console.warn(`[TinyFish] Failed to fetch ${url}: ${err.message}`);
      results.push({ url, title: '', text: '', description: '' });
    }
  }

  return results;
}

/**
 * Search the web using TinyFish Agent API.
 * Routes through Agent API using Google as the search engine,
 * since the Search API may not be available on all key tiers.
 *
 * @param {string} query - Search query
 * @param {number} [count=10] - Number of results
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, count = 10) {
  console.log(`[TinyFish] Searching: ${query}`);

  try {
    const { data } = await agentScrape(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      `Extract the top ${count} search results from this Google search page. For each result, get the title, URL, and snippet text. Return as JSON array: [{ title: string, url: string, snippet: string }]. Only include actual search results, not ads or "People also ask" sections.`,
      { timeout: 90000 },
    );

    if (Array.isArray(data)) return data.slice(0, count);
    if (data && Array.isArray(data.results)) return data.results.slice(0, count);
    if (data && typeof data === 'object') {
      // Try to find an array in the response
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) return data[key].slice(0, count);
      }
    }
    return [];
  } catch (err) {
    console.warn(`[TinyFish] Search failed for "${query}": ${err.message}`);
    return [];
  }
}

/**
 * Get the total number of agent steps taken across all calls.
 * @returns {number}
 */
export function getStepCount() {
  return stepCount;
}

/**
 * Reset the agent step counter to zero.
 */
export function resetStepCount() {
  stepCount = 0;
}
