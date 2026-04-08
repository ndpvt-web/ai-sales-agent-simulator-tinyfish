/**
 * Assembler Module
 * Merges multiple ScrapedSource objects into a single RawClientData.
 */

/** @typedef {import('../contracts/types.js').ScrapeRequest} ScrapeRequest */
/** @typedef {import('../contracts/types.js').ScrapedSource} ScrapedSource */
/** @typedef {import('../contracts/types.js').RawClientData} RawClientData */

const BLOG_KEYWORDS = ['blog', 'article', 'post', 'wrote', 'author', 'published', 'story', 'essay'];
const COMPANY_KEYWORDS = ['company', 'product', 'service', 'about', 'team', 'mission', 'vision', 'founded', 'startup', 'enterprise'];
const MAX_ITEM_CHARS = 3000;
const MAX_ARRAY_ITEMS = 20;

/**
 * Check if a string contains any of the given keywords (case-insensitive).
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
function containsKeyword(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

/**
 * Deduplicate an array of strings (exact match).
 * @param {string[]} arr
 * @returns {string[]}
 */
function dedup(arr) {
  return [...new Set(arr)];
}

/**
 * Truncate a string to maxChars.
 * @param {string} s
 * @param {number} maxChars
 * @returns {string}
 */
function truncate(s, maxChars) {
  if (typeof s !== 'string') return String(s ?? '');
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}

/**
 * Cap an array to maxItems after truncating each item.
 * @param {string[]} arr
 * @param {number} maxItems
 * @param {number} maxChars
 * @returns {string[]}
 */
function capArray(arr, maxItems = MAX_ARRAY_ITEMS, maxChars = MAX_ITEM_CHARS) {
  return arr
    .map(item => truncate(item, maxChars))
    .slice(0, maxItems);
}

/**
 * Merges multiple ScrapedSource objects into a single RawClientData.
 *
 * @param {ScrapeRequest} request - Original request with name/company/etc
 * @param {ScrapedSource[]} sources - Scraped sources to merge
 * @returns {RawClientData}
 */
export function assemble(request, sources) {
  /** @type {RawClientData} */
  const result = {
    name: request.name,
    title: request.title ?? null,
    company: request.company ?? null,
    industry: request.industry ?? null,
    linkedinPosts: [],
    tweets: [],
    blogPosts: [],
    publicStatements: [],
    companyInfo: [],
    metadata: {},
  };

  for (const source of sources) {
    const items = Array.isArray(source.items) ? source.items : [];
    const meta = source.metadata ?? {};

    switch (source.type) {
      case 'linkedin': {
        result.linkedinPosts.push(...items);
        if (!result.title && meta.title) {
          result.title = meta.title;
        }
        if (!result.company && meta.company) {
          result.company = meta.company;
        }
        break;
      }

      case 'twitter': {
        result.tweets.push(...items);
        if (meta.bio && typeof meta.bio === 'string') {
          result.publicStatements.push(meta.bio);
        }
        break;
      }

      case 'website': {
        for (const item of items) {
          if (containsKeyword(item, BLOG_KEYWORDS)) {
            result.blogPosts.push(item);
          } else if (containsKeyword(item, COMPANY_KEYWORDS)) {
            result.companyInfo.push(item);
          } else {
            // Default: companyInfo
            result.companyInfo.push(item);
          }
        }
        break;
      }

      case 'search':
      case 'blog':
      case 'news': {
        for (const item of items) {
          if (containsKeyword(item, COMPANY_KEYWORDS)) {
            result.companyInfo.push(item);
          } else {
            result.publicStatements.push(item);
          }
        }
        break;
      }

      default:
        // Unknown source type: add to publicStatements as a catch-all
        result.publicStatements.push(...items);
        break;
    }
  }

  // Deduplicate all arrays
  result.linkedinPosts = dedup(result.linkedinPosts);
  result.tweets = dedup(result.tweets);
  result.blogPosts = dedup(result.blogPosts);
  result.publicStatements = dedup(result.publicStatements);
  result.companyInfo = dedup(result.companyInfo);

  // Cap each array
  result.linkedinPosts = capArray(result.linkedinPosts);
  result.tweets = capArray(result.tweets);
  result.blogPosts = capArray(result.blogPosts);
  result.publicStatements = capArray(result.publicStatements);
  result.companyInfo = capArray(result.companyInfo);

  const totalItems =
    result.linkedinPosts.length +
    result.tweets.length +
    result.blogPosts.length +
    result.publicStatements.length +
    result.companyInfo.length;

  result.metadata = {
    scrapeSources: sources.length,
    scrapeTimestamp: Date.now(),
  };

  console.log(`[Assembler] Merged ${sources.length} sources -> ${totalItems} items`);

  return result;
}
