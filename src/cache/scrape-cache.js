/**
 * Filesystem Scrape Cache
 * Caches ScrapedData to avoid redundant scraping.
 * Cache directory: .cache/scrapes/ (relative to project root, created on first write)
 *
 * @module scrape-cache
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** @typedef {import('../contracts/types.js').ScrapedData} ScrapedData */

// Resolve project root: src/cache/ -> src/ -> project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const CACHE_DIR = join(PROJECT_ROOT, '.cache', 'scrapes');

/**
 * Generate cache key from name + company.
 * @param {string} name
 * @param {string} [company]
 * @returns {string} - slug like "alex-chen--techventures"
 */
export function cacheKey(name, company) {
  const slugify = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

  const namePart = slugify(name);
  if (!company) return namePart;
  const companyPart = slugify(company);
  return `${namePart}--${companyPart}`;
}

/**
 * Look up cached scrape data.
 * @param {string} key - Cache key from cacheKey()
 * @param {number} [ttlDays=7] - Max age in days
 * @returns {ScrapedData | null} - Cached data or null
 */
export function getCached(key, ttlDays = 7) {
  const filePath = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(filePath)) {
    console.log(`[CACHE] Miss: ${key}`);
    return null;
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const ttlMs = ttlDays * 86400000;
    const now = Date.now();

    if (!data.scrapedAt || data.scrapedAt + ttlMs <= now) {
      const ageDays = data.scrapedAt
        ? ((now - data.scrapedAt) / 86400000).toFixed(1)
        : 'unknown';
      console.log(`[CACHE] Miss: ${key} (expired, ${ageDays} days old)`);
      return null;
    }

    const ageDays = ((now - data.scrapedAt) / 86400000).toFixed(1);
    console.log(`[CACHE] Hit: ${key} (${ageDays} days old)`);
    return data;
  } catch (err) {
    console.log(`[CACHE] Miss: ${key} (parse error: ${err?.message ?? err})`);
    return null;
  }
}

/**
 * Write scrape data to cache.
 * @param {string} key - Cache key
 * @param {ScrapedData} data - Data to cache
 */
export function setCache(key, data) {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const filePath = join(CACHE_DIR, `${key}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[CACHE] Saved: ${key}`);
  } catch (err) {
    console.warn(`[CACHE] Warning: failed to save ${key}: ${err?.message ?? err}`);
  }
}
