/**
 * Strategy Generator
 * ===================
 * Generates diverse StrategyParams via Latin hypercube-like sampling,
 * then uses the AI gateway to produce email/conversation content.
 *
 * Exports:
 *   generateStrategies(mode, count, profile) -> Promise<StrategyParams[]>
 *   buildSalesAgent(strategy, profile) -> Promise<SalesAgentConfig>
 */

import { complete, randomModel } from '../gateway/ai-gateway.js';
import {
  OPENING_STYLES,
  VALUE_FRAMES,
  URGENCY_LEVELS,
  EMOTIONAL_TONES,
  OBJECTION_HANDLERS,
  EMAIL_SUBJECT_TEMPLATES,
} from './templates/email-strategies.js';
import {
  FOLLOW_UP_CADENCES,
  CLOSING_TECHNIQUES,
  CONVERSATION_OPENERS,
} from './templates/conversation-strategies.js';

// ============================================================
// Latin Hypercube Sampling Helpers
// ============================================================

/**
 * Shuffle an array in place (Fisher-Yates).
 * @param {any[]} arr
 * @returns {any[]}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Latin hypercube sample from a discrete array.
 * Divides the array into `count` strata and samples one from each.
 * If count > arr.length, cycles with shuffled repeats.
 * @param {any[]} arr
 * @param {number} count
 * @returns {any[]}
 */
function lhsSample(arr, count) {
  const result = [];
  const strataSize = arr.length / count;
  for (let i = 0; i < count; i++) {
    const strataStart = Math.floor(i * strataSize) % arr.length;
    const strataEnd = Math.min(Math.floor((i + 1) * strataSize), arr.length);
    const stratum = arr.slice(strataStart, Math.max(strataEnd, strataStart + 1));
    result.push(stratum[Math.floor(Math.random() * stratum.length)]);
  }
  return result;
}

/**
 * Build a unique strategy ID.
 * @param {string} mode
 * @param {number} index
 * @returns {string}
 */
function makeStrategyId(mode, index) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `strat-${mode}-${index}-${ts}-${rand}`;
}

// ============================================================
// Template interpolation
// ============================================================

/**
 * Fill {name}, {company}, {pain_point}, {industry} placeholders.
 * @param {string} template
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {string}
 */
function interpolate(template, profile) {
  const painPoint = profile.painPoints?.[0] ?? 'operational inefficiency';
  return template
    .replace(/\{name\}/g, profile.name ?? 'there')
    .replace(/\{company\}/g, profile.company ?? 'your company')
    .replace(/\{pain_point\}/g, painPoint)
    .replace(/\{industry\}/g, profile.industry ?? 'your industry');
}

// ============================================================
// Email content generation
// ============================================================

/**
 * Pick a subject template and interpolate it.
 * @param {import('../contracts/types.js').StrategyParams} strategy
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {string}
 */
function buildEmailSubject(strategy, profile) {
  const idx = Math.floor(Math.random() * EMAIL_SUBJECT_TEMPLATES.length);
  return interpolate(EMAIL_SUBJECT_TEMPLATES[idx], profile);
}

/**
 * Use AI gateway to generate a full email body for a strategy + profile.
 * @param {import('../contracts/types.js').StrategyParams} strategy
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {Promise<string>}
 */
async function generateEmailBody(strategy, profile) {
  const painPoint = profile.painPoints?.[0] ?? 'operational inefficiency';
  const persuasionTrigger = profile.persuasionTriggers?.[0] ?? 'ROI clarity';

  const prompt = `You are a world-class B2B sales copywriter. Write a short, personalized cold email (4-6 sentences, no more) using the following parameters:

Recipient: ${profile.name}, ${profile.title ?? 'Leader'} at ${profile.company} (${profile.industry})
Opening style: ${strategy.openingStyle}
Value frame: ${strategy.valueFrame}
Urgency level: ${strategy.urgencyLevel}
Emotional tone: ${strategy.emotionalTone}
Primary pain point: ${painPoint}
Persuasion trigger: ${persuasionTrigger}

Rules:
- Start with the opening style (do not use "I hope this email finds you well")
- Frame the value using the specified value frame
- Match the emotional tone throughout
- End with a single, low-friction call to action (e.g., "Worth a 15-minute call?")
- Do NOT include subject line, sign-off, or signature

Return ONLY the email body text, no JSON, no markdown.`;

  const messages = [{ role: 'user', content: prompt }];
  const model = randomModel();
  return complete({ messages, model, temperature: 0.8 });
}

/**
 * Use AI gateway to generate a conversation opener.
 * @param {import('../contracts/types.js').StrategyParams} strategy
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {Promise<string>}
 */
async function generateConversationOpener(strategy, profile) {
  // First try template-based opener
  const templates = CONVERSATION_OPENERS[strategy.openingStyle];
  if (templates?.length) {
    return interpolate(templates[Math.floor(Math.random() * templates.length)], profile);
  }

  // Fall back to AI generation
  const painPoint = profile.painPoints?.[0] ?? 'operational inefficiency';
  const prompt = `Write a single opening statement (2-3 sentences) for a B2B Zoom sales call using these parameters:
Prospect: ${profile.name}, ${profile.title ?? 'Leader'} at ${profile.company}
Opening style: ${strategy.openingStyle}
Emotional tone: ${strategy.emotionalTone}
Primary pain point: ${painPoint}
Return ONLY the opener text.`;

  const messages = [{ role: 'user', content: prompt }];
  const model = randomModel();
  return complete({ messages, model, temperature: 0.7 });
}

// ============================================================
// Main: generateStrategies
// ============================================================

/**
 * Generate `count` diverse strategies using Latin hypercube-like sampling.
 * @param {'email' | 'conversation'} mode
 * @param {number} count
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {Promise<import('../contracts/types.js').StrategyParams[]>}
 */
export async function generateStrategies(mode, count, profile) {
  // LHS across each dimension
  const openingStyles = lhsSample(shuffle(OPENING_STYLES), count);
  const valueFrames = lhsSample(shuffle(VALUE_FRAMES), count);
  const urgencyLevels = lhsSample(shuffle(URGENCY_LEVELS), count);
  const emotionalTones = lhsSample(shuffle(EMOTIONAL_TONES), count);
  const objectionHandlers = lhsSample(shuffle(OBJECTION_HANDLERS), count);

  // Conversation-only dimensions
  const followUpCadences = mode === 'conversation'
    ? lhsSample(shuffle(FOLLOW_UP_CADENCES), count)
    : null;
  const closingTechniques = mode === 'conversation'
    ? lhsSample(shuffle(CLOSING_TECHNIQUES), count)
    : null;

  // Build base strategy objects
  const strategies = Array.from({ length: count }, (_, i) => ({
    id: makeStrategyId(mode, i),
    mode,
    openingStyle: openingStyles[i],
    valueFrame: valueFrames[i],
    urgencyLevel: urgencyLevels[i],
    emotionalTone: emotionalTones[i],
    objectionHandling: objectionHandlers[i],
    ...(mode === 'conversation' && {
      followUpCadence: followUpCadences[i],
      closingTechnique: closingTechniques[i],
    }),
  }));

  // Enrich with AI-generated content in parallel
  const enriched = await Promise.all(
    strategies.map(async (strategy) => {
      if (mode === 'email') {
        const emailSubject = buildEmailSubject(strategy, profile);
        const emailBody = await generateEmailBody(strategy, profile);
        return { ...strategy, emailSubject, emailBody };
      } else {
        const conversationOpener = await generateConversationOpener(strategy, profile);
        return { ...strategy, conversationOpener };
      }
    })
  );

  return enriched;
}

// ============================================================
// Main: buildSalesAgent
// ============================================================

/**
 * Build a SalesAgentConfig from a strategy and client profile.
 * @param {import('../contracts/types.js').StrategyParams} strategy
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {Promise<import('../contracts/types.js').SalesAgentConfig>}
 */
export async function buildSalesAgent(strategy, profile) {
  const painPoints = profile.painPoints?.join(', ') ?? 'unspecified pain points';
  const persuasionTriggers = profile.persuasionTriggers?.join(', ') ?? 'value clarity';
  const objectionPatterns = profile.objectionPatterns?.join(', ') ?? 'price, timing';
  const turnOffs = profile.turnOffs?.join(', ') ?? 'pushy tactics, vague promises';

  const openingInstructions = {
    warm_personal: 'Open with genuine personal warmth. Reference something specific about the prospect or their company to establish authentic connection.',
    data_driven: 'Lead with a compelling data point or statistic relevant to the prospect\'s industry and challenge. Let the data frame the conversation.',
    provocative_question: 'Open with a bold, thought-provoking question that challenges the prospect\'s current assumptions about their situation.',
    mutual_connection: 'Reference the shared connection or context that created this introduction. Use it to build immediate credibility and rapport.',
    industry_insight: 'Lead with a sharp insight or trend observation from the prospect\'s industry. Position yourself as a knowledgeable peer.',
    direct_value: 'Be direct and clear about the value you deliver. Respect the prospect\'s time with concise, specific value framing from the first sentence.',
  };

  const valueFrameInstructions = {
    roi_focused: 'Frame every benefit in terms of measurable return on investment. Use numbers, percentages, and financial outcomes wherever possible.',
    risk_reduction: 'Frame value as risk mitigation. Emphasize what problems, losses, or downsides are avoided by acting.',
    competitive_edge: 'Frame value as competitive advantage. Emphasize how the prospect\'s competitors are moving and what staying ahead looks like.',
    innovation_leader: 'Frame the prospect as an innovation leader. Position your solution as what forward-thinking organizations are adopting.',
    efficiency_gain: 'Frame value as time saved, processes streamlined, and operational overhead reduced. Make the efficiency gains tangible.',
    social_proof: 'Frame value through peer success stories. Use case studies, logos, and outcomes from similar companies to build confidence.',
  };

  const toneInstructions = {
    empathetic: 'Maintain a genuinely empathetic tone. Acknowledge the prospect\'s challenges before offering solutions. Listen actively and validate their experience.',
    authoritative: 'Maintain a confident, authoritative tone. You are the expert in this space. Speak with conviction and certainty about the problem and the solution.',
    collaborative: 'Maintain a collaborative, partnership-oriented tone. Frame everything as working together toward a shared goal, not a vendor-client transaction.',
    consultative: 'Maintain a consultative, advisory tone. Ask insightful questions, diagnose deeply before prescribing, and position yourself as a trusted advisor.',
    challenger: 'Maintain a respectful but challenging tone. Gently push back on the prospect\'s assumptions, reframe their thinking, and introduce new perspectives.',
  };

  const urgencyInstructions = {
    low: 'Do not create artificial urgency. Let the value speak for itself. Focus on building trust and a strong foundation for a long-term relationship.',
    medium: 'Introduce natural urgency where appropriate — timelines, windows of opportunity, or seasonal factors. Do not manufacture pressure, but don\'t avoid it either.',
    high: 'Create appropriate urgency by referencing real deadlines, competitive dynamics, or the cost of inaction. Be direct about timing without being pushy.',
  };

  const objectionInstructions = {
    acknowledge_redirect: 'When facing objections, always acknowledge the concern first ("That\'s a fair point..."), then redirect toward the core value or a clarifying question.',
    data_counter: 'When facing objections, respond with specific data, benchmarks, or evidence. Let facts do the work of overcoming resistance.',
    social_proof: 'When facing objections, respond with relevant case studies or peer examples. Show the prospect that others in their position have navigated the same concern.',
    reframe_question: 'When facing objections, respond by reframing with a question that shifts the perspective. Turn the objection into an exploration of the underlying concern.',
    empathy_bridge: 'When facing objections, lead with deep empathy. Fully validate the concern, share that others have felt the same way, then bridge to how the situation resolved.',
  };

  const systemPrompt = `You are a skilled B2B sales professional conducting a ${strategy.mode === 'email' ? 'personalized email outreach' : 'live sales conversation'} with ${profile.name}, ${profile.title ?? 'a decision-maker'} at ${profile.company} in the ${profile.industry ?? 'business'} industry.

## YOUR OBJECTIVE
Engage ${profile.name} authentically, understand their challenges, and guide them toward agreeing to a next step (a follow-up call, demo, or meeting).

## OPENING APPROACH
${openingInstructions[strategy.openingStyle] ?? 'Open naturally and professionally.'}

## VALUE FRAMING
${valueFrameInstructions[strategy.valueFrame] ?? 'Frame your value clearly and relevantly.'}

## EMOTIONAL TONE
${toneInstructions[strategy.emotionalTone] ?? 'Maintain a professional and respectful tone.'}

## URGENCY LEVEL: ${strategy.urgencyLevel.toUpperCase()}
${urgencyInstructions[strategy.urgencyLevel]}

## OBJECTION HANDLING
${objectionInstructions[strategy.objectionHandling] ?? 'Handle objections with care and professionalism.'}

## PROSPECT CONTEXT
- Primary pain points: ${painPoints}
- Key persuasion triggers: ${persuasionTriggers}
- Likely objections: ${objectionPatterns}
- What turns them off: ${turnOffs}
- Communication style: ${profile.communicationStyle ?? 'unknown'}
- Decision style: ${profile.decisionStyle ?? 'unknown'}

## RULES
- Never be pushy, manipulative, or dishonest
- Always listen and adapt based on the prospect's responses
- Keep messages concise and purposeful
- If the prospect is disengaged, acknowledge it and adjust
- End every exchange with a clear, low-friction next step or question`;

  const model = randomModel();
  const temperature = strategy.emotionalTone === 'challenger' ? 0.85
    : strategy.emotionalTone === 'authoritative' ? 0.65
    : 0.75;

  return {
    strategyId: strategy.id,
    systemPrompt,
    model,
    temperature,
  };
}
