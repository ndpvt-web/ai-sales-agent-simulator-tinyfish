/**
 * Discovery Strategy
 * Uses TinyFish Search API to find a person's public online presence.
 * Returns discovered URLs categorised by source type.
 *
 * @module source-strategies/discovery
 */

import { searchWeb } from '../../gateway/tinyfish-gateway.js';

/** Domains that are NOT considered a personal/company website. */
const SOCIAL_DOMAINS = ['linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'youtube.com'];

/**
 * Extract a Twitter/X handle from a profile URL.
 *
 * @param {string} url
 * @returns {string|null}
 */
function extractTwitterHandle(url) {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
      const parts = pathname.replace(/^\//, '').split('/');
      if (parts[0] && !['search', 'hashtag', 'explore', 'home', 'i'].includes(parts[0])) {
        return parts[0];
      }
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

/**
 * Determine whether a URL looks like a standalone article or interview page
 * (as opposed to a social profile or bare domain homepage).
 *
 * @param {string} url
 * @returns {boolean}
 */
function looksLikeArticle(url) {
  try {
    const { hostname, pathname } = new URL(url);
    // Exclude bare homepages (pathname is '/' or very short)
    if (pathname.length < 5) return false;
    // Exclude known social / directory domains
    if (SOCIAL_DOMAINS.some((d) => hostname.includes(d))) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Discover a person's public online presence via web search.
 *
 * @param {string} name - Person's full name
 * @param {string} [company] - Company name for narrowing results
 * @param {string} [title] - Job title for narrowing results
 * @returns {Promise<{
 *   linkedinUrl?: string,
 *   twitterHandle?: string,
 *   websiteUrl?: string,
 *   articles: Array<{url: string, title: string, snippet: string}>
 * }>}
 */
export async function discoverPresence(name, company, title) {
  const context = [name, company || ''].join(' ').trim();

  const queries = [
    `${context} LinkedIn`,
    `${context} Twitter OR X.com`,
    `${context} interview OR podcast OR conference`,
    `${company || name} funding OR news OR press release`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => searchWeb(q, 5)));

  // Flatten all successful results, preserving order
  const allResults = settled.flatMap((outcome) =>
    outcome.status === 'fulfilled' && Array.isArray(outcome.value) ? outcome.value : []
  );

  let linkedinUrl;
  let twitterHandle;
  let websiteUrl;
  const articles = [];

  for (const result of allResults) {
    const url = result && typeof result.url === 'string' ? result.url : '';
    if (!url) continue;

    // LinkedIn profile
    if (!linkedinUrl && url.includes('linkedin.com/in/')) {
      linkedinUrl = url;
      continue;
    }

    // Twitter/X profile
    if (!twitterHandle && (url.includes('x.com/') || url.includes('twitter.com/'))) {
      const handle = extractTwitterHandle(url);
      if (handle) {
        twitterHandle = handle;
        continue;
      }
    }

    // Company/personal website (not a social platform)
    if (!websiteUrl && !SOCIAL_DOMAINS.some((d) => url.includes(d))) {
      try {
        const { pathname } = new URL(url);
        // Prefer root or near-root pages for the primary website hit
        if (pathname.length <= 1 || pathname === '/') {
          websiteUrl = url;
          continue;
        }
      } catch {
        // skip malformed
      }
    }

    // Articles / interviews / press
    if (articles.length < 10 && looksLikeArticle(url)) {
      articles.push({
        url,
        title: result.title || '',
        snippet: result.snippet || '',
      });
    }
  }

  // Fallback: if no clean homepage found, use first non-social URL from results
  if (!websiteUrl) {
    for (const result of allResults) {
      const url = result && typeof result.url === 'string' ? result.url : '';
      if (!url) continue;
      if (SOCIAL_DOMAINS.some((d) => url.includes(d))) continue;
      try {
        websiteUrl = new URL(url).origin;
        break;
      } catch {
        // skip
      }
    }
  }

  console.log(
    `[Discovery] Found: LinkedIn=${!!linkedinUrl}, Twitter=${!!twitterHandle}, Website=${!!websiteUrl}, Articles=${articles.length}`
  );

  return {
    ...(linkedinUrl ? { linkedinUrl } : {}),
    ...(twitterHandle ? { twitterHandle } : {}),
    ...(websiteUrl ? { websiteUrl } : {}),
    articles,
  };
}
