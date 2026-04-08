/**
 * Prospect Scraper - Orchestration Module
 * Coordinates discovery, parallel scraping, assembly, and caching.
 *
 * Contract: scrapeProspect(request: ScrapeRequest, options?) -> Promise<ScrapedData>
 */

import { scrapeLinkedIn } from './source-strategies/linkedin.js';
import { scrapeTwitter } from './source-strategies/twitter.js';
import { scrapeWebsite } from './source-strategies/website.js';
import { discoverPresence } from './source-strategies/discovery.js';
import { assemble } from './assembler.js';
import { cacheKey, getCached, setCache } from '../cache/scrape-cache.js';
import { getStepCount, resetStepCount } from '../gateway/tinyfish-gateway.js';

/** @typedef {import('../contracts/types.js').ScrapeRequest} ScrapeRequest */
/** @typedef {import('../contracts/types.js').ScrapedData} ScrapedData */
/** @typedef {import('../contracts/types.js').ScrapedSource} ScrapedSource */

const SCRAPE_CONCURRENCY = 3;

/**
 * Process an array of async tasks with bounded concurrency.
 * @template T
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} concurrency
 * @returns {Promise<Array<T | null>>}
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Scrape public data for a prospect and assemble into RawClientData.
 *
 * @param {ScrapeRequest} request
 * @param {Object} [options]
 * @param {boolean} [options.noCache=false] - Skip cache lookup
 * @param {number} [options.cacheTtl=7] - Cache TTL in days
 * @param {boolean} [options.dryRun=false] - Log what would be scraped without doing it
 * @returns {Promise<ScrapedData>}
 */
export async function scrapeProspect(request, options = {}) {
  const { noCache = false, cacheTtl = 7, dryRun = false } = options;

  // --- Phase 1: Cache check ---
  const key = cacheKey(request.name, request.company);

  if (!noCache) {
    const cached = getCached(key, cacheTtl);
    if (cached) {
      return cached;
    }
  }

  // --- Dry run: log and return empty ScrapedData ---
  if (dryRun) {
    console.log(`[Scraper] Dry run for: ${request.name} (${request.company ?? 'no company'})`);
    console.log(`[Scraper] Would check: linkedinUrl=${request.linkedinUrl ?? '(discover)'}, twitterHandle=${request.twitterHandle ?? '(discover)'}, websiteUrl=${request.websiteUrl ?? '(discover)'}`);
    return {
      request,
      sources: [],
      assembled: assemble(request, []),
      totalSources: 0,
      scrapedAt: Date.now(),
    };
  }

  // --- Phase 2: Discovery (if no URLs provided) ---
  const needsDiscovery =
    !request.linkedinUrl && !request.twitterHandle && !request.websiteUrl;

  /** @type {Array<{url: string, title: string, snippet: string}>} */
  let discoveredArticles = [];

  if (needsDiscovery) {
    try {
      console.log(`[Scraper] Discovering presence for: ${request.name}`);
      const presence = await discoverPresence(
        request.name,
        request.company,
        request.title
      );

      if (presence.linkedinUrl) {
        request = { ...request, linkedinUrl: presence.linkedinUrl };
        console.log(`[Scraper] Discovered LinkedIn: ${presence.linkedinUrl}`);
      }
      if (presence.twitterHandle) {
        request = { ...request, twitterHandle: presence.twitterHandle };
        console.log(`[Scraper] Discovered Twitter: ${presence.twitterHandle}`);
      }
      if (presence.websiteUrl) {
        request = { ...request, websiteUrl: presence.websiteUrl };
        console.log(`[Scraper] Discovered website: ${presence.websiteUrl}`);
      }
      if (Array.isArray(presence.articles)) {
        discoveredArticles = presence.articles;
        console.log(`[Scraper] Discovered ${discoveredArticles.length} articles`);
      }
    } catch (err) {
      console.warn(`[Scraper] Discovery failed: ${err?.message ?? err}`);
    }
  }

  // --- Phase 3: Parallel extraction (bounded concurrency = 3) ---

  /** @type {Array<() => Promise<ScrapedSource | null>>} */
  const tasks = [];

  if (request.linkedinUrl) {
    tasks.push(async () => {
      try {
        return await scrapeLinkedIn(request.linkedinUrl, request.name);
      } catch (err) {
        console.warn(`[Scraper] LinkedIn scrape failed: ${err?.message ?? err}`);
        return null;
      }
    });
  }

  if (request.twitterHandle) {
    tasks.push(async () => {
      try {
        return await scrapeTwitter(request.twitterHandle);
      } catch (err) {
        console.warn(`[Scraper] Twitter scrape failed: ${err?.message ?? err}`);
        return null;
      }
    });
  }

  if (request.websiteUrl) {
    tasks.push(async () => {
      try {
        return await scrapeWebsite(request.websiteUrl, request.name);
      } catch (err) {
        console.warn(`[Scraper] Website scrape failed: ${err?.message ?? err}`);
        return null;
      }
    });
  }

  // Add up to 3 discovered articles
  const articleSlice = discoveredArticles.slice(0, 3);
  for (const article of articleSlice) {
    tasks.push(async () => {
      try {
        const source = await scrapeWebsite(article.url, request.name);
        // Adjust type to reflect article/news origin
        return { ...source, type: /** @type {'news'} */ ('news') };
      } catch (err) {
        console.warn(`[Scraper] Article scrape failed (${article.url}): ${err?.message ?? err}`);
        return null;
      }
    });
  }

  // Also handle any additionalUrls
  if (Array.isArray(request.additionalUrls)) {
    for (const url of request.additionalUrls) {
      tasks.push(async () => {
        try {
          return await scrapeWebsite(url, request.name);
        } catch (err) {
          console.warn(`[Scraper] Additional URL scrape failed (${url}): ${err?.message ?? err}`);
          return null;
        }
      });
    }
  }

  const rawResults = await runWithConcurrency(tasks, SCRAPE_CONCURRENCY);

  /** @type {ScrapedSource[]} */
  const sources = rawResults.filter(Boolean);

  // --- Phase 4: Assembly + cache ---
  const assembled = assemble(request, sources);

  /** @type {ScrapedData} */
  const scrapedData = {
    request,
    sources,
    assembled,
    totalSources: sources.length,
    scrapedAt: Date.now(),
  };

  setCache(key, scrapedData);

  const steps = getStepCount();
  console.log(
    `[Scraper] Complete: ${sources.length} sources, ${steps} TinyFish steps (~$${(steps * 0.015).toFixed(2)} est.)`
  );
  resetStepCount();

  return scrapedData;
}
