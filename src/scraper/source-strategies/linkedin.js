/**
 * LinkedIn Source Strategy
 * Uses TinyFish Agent API to scrape public LinkedIn profile data.
 *
 * @module source-strategies/linkedin
 */

import { agentScrape } from '../../gateway/tinyfish-gateway.js';

const LINKEDIN_GOAL =
  'Navigate to this LinkedIn profile. Extract: 1. Full name, headline, current job title and company. ' +
  '2. About/summary section. 3. Up to 10 most recent posts or articles with their full text. ' +
  '4. Featured content titles. 5. Education and certifications. ' +
  'Return as JSON with fields: name (string), headline (string), title (string), company (string), ' +
  'about (string), posts (array of {text, date, likes}), featured (array of strings), education (array of strings).';

/**
 * Scrape a public LinkedIn profile.
 *
 * @param {string} url - LinkedIn profile URL
 * @param {string} name - Person's name (for context/validation)
 * @returns {Promise<import('../../contracts/types.js').ScrapedSource>}
 */
export async function scrapeLinkedIn(url, name) {
  try {
    const result = await agentScrape(url, LINKEDIN_GOAL);

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

    const posts = Array.isArray(data.posts) ? data.posts : [];
    const items = [
      ...(data.about ? [data.about] : []),
      ...posts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean),
    ];

    return {
      type: 'linkedin',
      url,
      items,
      metadata: {
        name: data.name ?? name ?? null,
        headline: data.headline ?? null,
        title: data.title ?? null,
        company: data.company ?? null,
        education: Array.isArray(data.education) ? data.education : [],
        featured: Array.isArray(data.featured) ? data.featured : [],
      },
      scrapedAt: Date.now(),
    };
  } catch (err) {
    console.warn(`[LinkedIn] Failed to scrape ${url}: ${err.message}`);
    return {
      type: 'linkedin',
      url,
      items: [],
      metadata: { error: err.message },
      scrapedAt: Date.now(),
    };
  }
}
