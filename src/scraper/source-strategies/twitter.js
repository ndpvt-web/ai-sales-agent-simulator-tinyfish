/**
 * Twitter/X Source Strategy
 * Uses TinyFish Agent API to scrape public Twitter/X profile data.
 *
 * @module source-strategies/twitter
 */

import { agentScrape } from '../../gateway/tinyfish-gateway.js';

const TWITTER_GOAL =
  'Go to this Twitter/X profile. Extract the bio, follower count, and the 20 most recent original tweets ' +
  '(skip retweets and replies). Return as JSON: { bio (string), followers (number), tweets (array of {text, date, likes}) }';

/**
 * Normalize a Twitter handle or URL to a full profile URL.
 *
 * @param {string} handle - Twitter handle (with or without @) or full URL
 * @returns {string} Canonical https://x.com/<handle> URL
 */
function normalizeTwitterUrl(handle) {
  if (typeof handle === 'string' && handle.startsWith('http')) {
    return handle;
  }
  const clean = (handle || '').replace(/^@/, '').trim();
  return `https://x.com/${clean}`;
}

/**
 * Scrape a public Twitter/X profile.
 *
 * @param {string} handle - Twitter handle (no @) or full URL
 * @returns {Promise<import('../../contracts/types.js').ScrapedSource>}
 */
export async function scrapeTwitter(handle) {
  const url = normalizeTwitterUrl(handle);

  try {
    const result = await agentScrape(url, TWITTER_GOAL);

    /** @type {Object} */
    let data = result.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    if (!data || typeof data !== 'object') {
      data = {};
    }

    const tweets = Array.isArray(data.tweets) ? data.tweets : [];
    const items = tweets
      .map((t) => (t && typeof t.text === 'string' ? t.text : ''))
      .filter(Boolean);

    return {
      type: 'twitter',
      url,
      items,
      metadata: {
        bio: data.bio ?? null,
        followers: typeof data.followers === 'number' ? data.followers : null,
      },
      scrapedAt: Date.now(),
    };
  } catch (err) {
    console.warn(`[Twitter] Failed to scrape ${url}: ${err.message}`);
    return {
      type: 'twitter',
      url,
      items: [],
      metadata: { error: err.message },
      scrapedAt: Date.now(),
    };
  }
}
