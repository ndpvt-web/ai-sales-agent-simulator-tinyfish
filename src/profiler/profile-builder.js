/**
 * Profiler Module: profile-builder.js
 * =====================================
 * Contract: buildProfile(rawData: RawClientData) -> Promise<ClientProfile>
 *
 * Analyzes raw client data through AI to produce a structured ClientProfile
 * capturing personality, communication style, values, and sales-relevant traits.
 */

import { completeJSON } from '../gateway/ai-gateway.js';

/**
 * Serializes raw client data into a readable text block for the AI prompt.
 * @param {import('../contracts/types.js').RawClientData} raw
 * @returns {string}
 */
function serializeRawData(raw) {
  const sections = [];

  sections.push(`Name: ${raw.name}`);
  if (raw.title) sections.push(`Title: ${raw.title}`);
  if (raw.company) sections.push(`Company: ${raw.company}`);
  if (raw.industry) sections.push(`Industry: ${raw.industry}`);

  if (raw.linkedinPosts?.length) {
    sections.push('\n--- LinkedIn Posts ---');
    raw.linkedinPosts.forEach((p, i) => sections.push(`[${i + 1}] ${p}`));
  }

  if (raw.tweets?.length) {
    sections.push('\n--- Tweets ---');
    raw.tweets.forEach((t, i) => sections.push(`[${i + 1}] ${t}`));
  }

  if (raw.blogPosts?.length) {
    sections.push('\n--- Blog Posts ---');
    raw.blogPosts.forEach((b, i) => sections.push(`[${i + 1}] ${b}`));
  }

  if (raw.publicStatements?.length) {
    sections.push('\n--- Public Statements / Interviews ---');
    raw.publicStatements.forEach((s, i) => sections.push(`[${i + 1}] ${s}`));
  }

  if (raw.companyInfo?.length) {
    sections.push('\n--- Company Information ---');
    raw.companyInfo.forEach((c, i) => sections.push(`[${i + 1}] ${c}`));
  }

  if (raw.metadata) {
    sections.push('\n--- Additional Metadata ---');
    sections.push(JSON.stringify(raw.metadata, null, 2));
  }

  return sections.join('\n');
}

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    personality: {
      type: 'object',
      properties: {
        openness: { type: 'number', description: '0.0 to 1.0' },
        conscientiousness: { type: 'number', description: '0.0 to 1.0' },
        extraversion: { type: 'number', description: '0.0 to 1.0' },
        agreeableness: { type: 'number', description: '0.0 to 1.0' },
        neuroticism: { type: 'number', description: '0.0 to 1.0' },
      },
      required: ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'],
    },
    communicationStyle: {
      type: 'string',
      enum: ['analytical', 'driver', 'amiable', 'expressive'],
    },
    values: {
      type: 'array',
      items: { type: 'string' },
      description: 'Core values inferred from the data (3-6 items)',
    },
    painPoints: {
      type: 'array',
      items: { type: 'string' },
      description: 'Business or professional pain points (3-6 items)',
    },
    priorities: {
      type: 'array',
      items: { type: 'string' },
      description: 'Current top priorities (3-5 items)',
    },
    objectionPatterns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Likely objection types in sales situations (3-5 items)',
    },
    persuasionTriggers: {
      type: 'array',
      items: { type: 'string' },
      description: 'Factors that motivate or accelerate decisions (3-5 items)',
    },
    turnOffs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Behaviors or tactics that cause disengagement (3-5 items)',
    },
    decisionStyle: {
      type: 'string',
      description: 'A 1-2 sentence description of how this person makes decisions',
    },
    summary: {
      type: 'string',
      description: '2-3 paragraph behavioral summary for a sales professional',
    },
  },
  required: [
    'personality',
    'communicationStyle',
    'values',
    'painPoints',
    'priorities',
    'objectionPatterns',
    'persuasionTriggers',
    'turnOffs',
    'decisionStyle',
    'summary',
  ],
};

/**
 * Builds a structured ClientProfile from raw client data using AI analysis.
 * @param {import('../contracts/types.js').RawClientData} rawData
 * @returns {Promise<import('../contracts/types.js').ClientProfile>}
 */
export async function buildProfile(rawData) {
  const clientDataText = serializeRawData(rawData);

  const systemPrompt = `You are an expert behavioral psychologist and sales intelligence analyst.
Your job is to analyze publicly available information about a business professional and produce
a precise psychological and behavioral profile to help a sales team engage them effectively.

Be evidence-based: ground every inference in the actual data provided.
Be specific: avoid generic descriptions — capture what makes this person distinct.
Be practical: the output must be actionable for a sales professional.`;

  const userPrompt = `Analyze the following information about a potential client and produce a structured profile.

${clientDataText}

Provide your analysis as a JSON object with EXACTLY these keys (use camelCase as shown):

{
  "personality": { "openness": 0.0-1.0, "conscientiousness": 0.0-1.0, "extraversion": 0.0-1.0, "agreeableness": 0.0-1.0, "neuroticism": 0.0-1.0 },
  "communicationStyle": "analytical" | "driver" | "amiable" | "expressive",
  "values": ["string array of 3-6 core values"],
  "painPoints": ["string array of 3-6 business pain points"],
  "priorities": ["string array of 3-5 current priorities"],
  "objectionPatterns": ["string array of 3-5 likely objection types in sales situations"],
  "persuasionTriggers": ["string array of 3-5 factors that accelerate decisions"],
  "turnOffs": ["string array of 3-5 behaviors that cause disengagement"],
  "decisionStyle": "1-2 sentence description of how they make decisions",
  "summary": "2-3 paragraph behavioral summary for a sales professional"
}

Use EXACTLY these key names. Do not rename or restructure them.`;

  let analysis;
  try {
    analysis = await completeJSON({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
  } catch (err) {
    throw new Error(`Profile AI analysis failed: ${err.message}`);
  }

  // Handle cases where the model wraps the result in a container key
  if (!analysis.personality && typeof analysis === 'object') {
    const keys = Object.keys(analysis);
    if (keys.length === 1 && typeof analysis[keys[0]] === 'object' && analysis[keys[0]].personality) {
      analysis = analysis[keys[0]];
    }
  }

  if (!analysis.personality) {
    throw new Error(`Profile AI returned unexpected structure. Keys: ${Object.keys(analysis).join(', ')}`);
  }

  /** @type {import('../contracts/types.js').ClientProfile} */
  const profile = {
    id: crypto.randomUUID(),
    name: rawData.name,
    title: rawData.title ?? '',
    company: rawData.company ?? '',
    industry: rawData.industry ?? '',
    personality: {
      openness: clamp(analysis.personality.openness),
      conscientiousness: clamp(analysis.personality.conscientiousness),
      extraversion: clamp(analysis.personality.extraversion),
      agreeableness: clamp(analysis.personality.agreeableness),
      neuroticism: clamp(analysis.personality.neuroticism),
    },
    communicationStyle: analysis.communicationStyle,
    values: analysis.values ?? [],
    painPoints: analysis.painPoints ?? [],
    priorities: analysis.priorities ?? [],
    objectionPatterns: analysis.objectionPatterns ?? [],
    persuasionTriggers: analysis.persuasionTriggers ?? [],
    turnOffs: analysis.turnOffs ?? [],
    decisionStyle: analysis.decisionStyle ?? '',
    summary: analysis.summary ?? '',
  };

  return profile;
}

/**
 * Clamps a number to [0, 1].
 * @param {number} val
 * @returns {number}
 */
function clamp(val) {
  return Math.min(1, Math.max(0, Number(val) || 0));
}
