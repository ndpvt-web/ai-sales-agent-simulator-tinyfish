/**
 * TinyFish Gateway Module
 * =======================
 * Axiom: All TinyFish API communication flows through a single abstraction.
 * No module calls TinyFish directly. This is the only HTTP boundary.
 *
 * Contract: Three endpoints — agentScrape, fetchPages, searchWeb.
 * Retry logic: exponential backoff on 429/502/503. Max 3 retries.
 */

const AGENT_URL = 'https://agent.tinyfish.ai/v1/automation/run';
const FETCH_URL = 'https://api.fetch.tinyfish.ai';
const SEARCH_URL = 'https://api.search.tinyfish.ai';

const DEFAULT_TIMEOUT = parseInt(process.env.TINYFISH_TIMEOUT || '60000', 10);
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
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an HTTP request with retry logic on 429/502/503.
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} [timeout]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, init, timeout = DEFAULT_TIMEOUT) {
  const NO_RETRY_CODES = new Set([400, 401, 404]);
  const RETRY_CODES = new Set([429, 502, 503]);
  const MAX_RETRIES = 3;

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      if (NO_RETRY_CODES.has(res.status)) {
        const errText = await res.text();
        throw new Error(`TinyFish API error (${res.status}): ${errText}`);
      }

      if (RETRY_CODES.has(res.status) && attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(backoff);
        continue;
      }

      const errText = await res.text();
      throw new Error(`TinyFish API error (${res.status}): ${errText}`);
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`TinyFish request timed out after ${timeout}ms: ${url}`);
      }
      // Rethrow non-retry errors immediately
      if (!(err.message && err.message.startsWith('TinyFish API error')) || NO_RETRY_CODES.has(parseInt(err.message.match(/\((\d+)\)/)?.[1] || '0'))) {
        if (attempt >= MAX_RETRIES) throw err;
        lastErr = err;
        const backoff = Math.pow(2, attempt) * 1000;
        await sleep(backoff);
      } else {
        throw err;
      }
    }
  }
  throw lastErr || new Error('TinyFish request failed after retries');
}

/**
 * Scrape a URL using TinyFish Agent API with SSE streaming.
 * Endpoint: POST https://agent.tinyfish.ai/v1/automation/run
 * Uses synchronous /run endpoint (not SSE) for simplicity.
 * Headers: X-API-Key, Content-Type: application/json
 * Body: { url, goal, proxy_config?: { country_code } }
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

  const res = await fetchWithRetry(
    AGENT_URL,
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeout,
  );

  const response = await res.json();
  const steps = response.steps_taken || 0;
  stepCount += steps;

  return {
    data: response.data,
    steps,
    runId: response.run_id || '',
  };
}

/**
 * Fetch and extract content from URLs using TinyFish Fetch API.
 * Endpoint: POST https://api.fetch.tinyfish.ai
 * Headers: X-API-Key, Content-Type: application/json
 * Body: { urls: string[], format: 'markdown'|'html'|'json', proxy_config? }
 * Response: { results: [{ url, title, text, description }], errors: [] }
 *
 * @param {string[]} urls - Up to 10 URLs to fetch
 * @param {string} [format='markdown'] - Output format
 * @returns {Promise<Array<{url: string, title: string, text: string, description: string}>>}
 */
export async function fetchPages(urls, format = 'markdown') {
  console.log(`[TinyFish] Fetching ${urls.length} page(s): ${urls[0]}${urls.length > 1 ? ` +${urls.length - 1} more` : ''}`);

  const apiKey = getApiKey();

  const body = {
    urls,
    format,
    proxy_config: { country_code: DEFAULT_PROXY },
  };

  const res = await fetchWithRetry(FETCH_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const response = await res.json();
  return response.results || [];
}

/**
 * Search the web using TinyFish Search API.
 * Endpoint: GET https://api.search.tinyfish.ai
 * Query params: q, count, X-API-Key header
 * Response: { results: [{ title, url, snippet }] }
 *
 * @param {string} query - Search query
 * @param {number} [count=10] - Number of results
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, count = 10) {
  console.log(`[TinyFish] Searching: ${query}`);

  const apiKey = getApiKey();

  const params = new URLSearchParams({ q: query, count: String(count) });
  const url = `${SEARCH_URL}?${params}`;

  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  const response = await res.json();
  return response.results || [];
}

/**
 * Get the total number of agent steps taken across all agentScrape calls.
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
