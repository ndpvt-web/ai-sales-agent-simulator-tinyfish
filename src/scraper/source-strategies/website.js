/**
 * Website Source Strategy
 * Uses TinyFish Fetch API to extract content from company/personal websites.
 *
 * @module source-strategies/website
 */

import { fetchPages } from '../../gateway/tinyfish-gateway.js';

/** Keywords that indicate high-value sub-pages for person/company research. */
const SUB_PAGE_KEYWORDS = ['about', 'team', 'blog', 'press', 'news', 'leadership'];

/** Maximum number of sub-pages to fetch in addition to the root page. */
const MAX_SUB_PAGES = 5;

/** Maximum characters to retain per page text item. */
const MAX_ITEM_CHARS = 2000;

/**
 * Extract the hostname from a URL string, or null on failure.
 *
 * @param {string} url
 * @returns {string|null}
 */
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Find sub-page URLs within a page's text content that match
 * known high-value keywords and belong to the same domain.
 *
 * @param {string} text - Raw page text/markdown
 * @param {string} rootUrl - The root URL being scraped
 * @returns {string[]} Up to MAX_SUB_PAGES unique sub-page URLs
 */
function extractSubPageUrls(text, rootUrl) {
  const rootHostname = getHostname(rootUrl);
  if (!rootHostname) return [];

  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  const found = text.match(urlPattern) || [];

  const seen = new Set();
  const subPages = [];

  for (const candidate of found) {
    if (subPages.length >= MAX_SUB_PAGES) break;

    // Must be on the same domain
    if (getHostname(candidate) !== rootHostname) continue;

    // Must contain at least one keyword
    const lower = candidate.toLowerCase();
    if (!SUB_PAGE_KEYWORDS.some((kw) => lower.includes(kw))) continue;

    // Deduplicate
    const normalised = candidate.replace(/\/$/, '');
    if (seen.has(normalised) || normalised === rootUrl.replace(/\/$/, '')) continue;

    seen.add(normalised);
    subPages.push(candidate);
  }

  return subPages;
}

/**
 * Scrape a website, following key sub-pages for richer content.
 *
 * @param {string} url - Website URL
 * @param {string} [personName] - Person name for relevance filtering (reserved for future use)
 * @returns {Promise<import('../../contracts/types.js').ScrapedSource>}
 */
export async function scrapeWebsite(url, personName) {
  try {
    // Fetch the root page first
    const [mainPage, ...rest] = await fetchPages([url], 'markdown');
    void rest; // only one URL requested

    const mainText = (mainPage && mainPage.text) ? mainPage.text : '';

    // Discover sub-pages from the main page content
    const subPageUrls = extractSubPageUrls(mainText, url);

    // Batch-fetch sub-pages if any were found
    let subPages = [];
    if (subPageUrls.length > 0) {
      subPages = await fetchPages(subPageUrls, 'markdown');
    }

    // Collect all text items, truncated to MAX_ITEM_CHARS each
    const allPages = [mainPage, ...subPages].filter(Boolean);
    const items = allPages
      .map((p) => (p && typeof p.text === 'string' ? p.text.slice(0, MAX_ITEM_CHARS) : ''))
      .filter(Boolean);

    return {
      type: 'website',
      url,
      items,
      metadata: {
        pagesScraped: allPages.length,
        subPages: subPageUrls,
      },
      scrapedAt: Date.now(),
    };
  } catch (err) {
    console.warn(`[Website] Failed to scrape ${url}: ${err.message}`);
    return {
      type: 'website',
      url,
      items: [],
      metadata: { error: err.message },
      scrapedAt: Date.now(),
    };
  }
}
