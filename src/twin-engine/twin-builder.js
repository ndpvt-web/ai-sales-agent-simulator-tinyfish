/**
 * Twin Engine Module: twin-builder.js
 * =====================================
 * Contract: createTwin(profile: ClientProfile, model?: string) -> Promise<TwinPersona>
 *
 * Takes a ClientProfile and builds a rich TwinPersona: a system prompt + model config
 * that causes an LLM to behave authentically as that client during sales simulations.
 */

import { randomModel } from '../gateway/ai-gateway.js';

/**
 * Maps a communication style to a descriptive behavioral directive.
 * @param {import('../contracts/types.js').CommunicationStyle} style
 * @returns {string}
 */
function communicationStyleDirective(style) {
  const directives = {
    analytical: 'You communicate in a precise, data-driven way. You ask for evidence, question assumptions, and want specifics before forming opinions. You are skeptical of hype and emotional appeals.',
    driver: 'You communicate directly and results-focused. You are impatient with small talk, want the bottom line immediately, and respect people who are confident and concise. You push back hard when you sense time is being wasted.',
    amiable: 'You communicate warmly and relationship-first. You care about trust and personal connection before business. You avoid conflict but will disengage passively if you feel pressured or manipulated.',
    expressive: 'You communicate with energy and enthusiasm. You love big ideas, storytelling, and vision. You get bored by dry details and are drawn to people who match your passion and creativity.',
  };
  return directives[style] ?? directives.analytical;
}

/**
 * Converts Big Five scores into natural language personality descriptors.
 * @param {import('../contracts/types.js').PersonalityScores} p
 * @returns {string[]}
 */
function personalityDescriptors(p) {
  const descriptors = [];

  if (p.openness > 0.7) descriptors.push('highly curious and open to novel ideas and unconventional approaches');
  else if (p.openness < 0.4) descriptors.push('pragmatic and skeptical of unproven or experimental ideas');

  if (p.conscientiousness > 0.7) descriptors.push('detail-oriented, organized, and expect the same level of thoroughness from others');
  else if (p.conscientiousness < 0.4) descriptors.push('big-picture focused and can be impatient with excessive detail or process');

  if (p.extraversion > 0.7) descriptors.push('energized by conversation and quick to engage, but also quick to move on');
  else if (p.extraversion < 0.4) descriptors.push('reserved and thoughtful; prefer to process before responding');

  if (p.agreeableness > 0.7) descriptors.push('cooperative and conflict-averse; find it hard to say no directly');
  else if (p.agreeableness < 0.4) descriptors.push('direct and willing to push back; do not soften criticism');

  if (p.neuroticism > 0.7) descriptors.push('sensitive to risk and uncertainty; may overreact to perceived threats or pressure');
  else if (p.neuroticism < 0.4) descriptors.push('emotionally stable under pressure; rarely rattled by urgency tactics');

  return descriptors;
}

/**
 * Derives a temperature value from personality traits.
 * High extraversion and openness -> higher temperature (more variability in responses).
 * High conscientiousness and low neuroticism -> lower temperature (more predictable).
 * @param {import('../contracts/types.js').PersonalityScores} personality
 * @returns {number} temperature in [0.4, 0.95]
 */
function deriveTemperature(personality) {
  const base = 0.6;
  const extraversionBoost = (personality.extraversion - 0.5) * 0.3;
  const opennessBoost = (personality.openness - 0.5) * 0.15;
  const conscientiousnessReduction = (personality.conscientiousness - 0.5) * -0.1;
  const neuroticismReduction = (personality.neuroticism - 0.5) * -0.05;

  const raw = base + extraversionBoost + opennessBoost + conscientiousnessReduction + neuroticismReduction;
  return Math.round(Math.min(0.95, Math.max(0.4, raw)) * 100) / 100;
}

/**
 * Builds the full system prompt that makes an LLM behave as the client twin.
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {string}
 */
function buildSystemPrompt(profile) {
  const personalityLines = personalityDescriptors(profile.personality);
  const styleDirective = communicationStyleDirective(profile.communicationStyle);

  const sections = [];

  sections.push(`You are roleplaying as ${profile.name}, ${profile.title} at ${profile.company} (${profile.industry} industry).`);
  sections.push(`You are NOT an AI assistant. You are this specific person. Stay in character at all times.`);
  sections.push(`Never break character, never explain your reasoning as an AI, and never mention that you are simulating a person.`);

  sections.push(`\n## WHO YOU ARE\n${profile.summary}`);

  sections.push(`\n## YOUR PERSONALITY`);
  if (personalityLines.length > 0) {
    sections.push(`You are ${personalityLines.join('; ')}.`);
  }
  sections.push(`\nYour communication style: ${styleDirective}`);

  if (profile.values.length > 0) {
    sections.push(`\n## YOUR CORE VALUES`);
    sections.push(`You hold these values deeply and they filter how you evaluate everything:`);
    profile.values.forEach(v => sections.push(`- ${v}`));
  }

  if (profile.painPoints.length > 0) {
    sections.push(`\n## YOUR PAIN POINTS`);
    sections.push(`These are real frustrations in your professional life right now:`);
    profile.painPoints.forEach(p => sections.push(`- ${p}`));
  }

  if (profile.priorities.length > 0) {
    sections.push(`\n## YOUR CURRENT PRIORITIES`);
    sections.push(`Your attention and budget flow toward these goals:`);
    profile.priorities.forEach(p => sections.push(`- ${p}`));
  }

  sections.push(`\n## YOUR DECISION-MAKING STYLE`);
  sections.push(profile.decisionStyle);

  if (profile.objectionPatterns.length > 0) {
    sections.push(`\n## HOW YOU RESPOND TO SALES PITCHES`);
    sections.push(`When someone tries to sell you something, you have characteristic objection patterns:`);
    profile.objectionPatterns.forEach(o => sections.push(`- ${o}`));
    sections.push(`\nRaise these objections naturally when they are relevant. Do not raise all of them at once.`);
    sections.push(`Escalate skepticism if you feel pressured. Back off if the salesperson addresses your concern well.`);
  }

  if (profile.persuasionTriggers.length > 0) {
    sections.push(`\n## WHAT MOVES YOU`);
    sections.push(`These factors genuinely shift your position toward yes:`);
    profile.persuasionTriggers.forEach(t => sections.push(`- ${t}`));
  }

  if (profile.turnOffs.length > 0) {
    sections.push(`\n## WHAT KILLS THE DEAL`);
    sections.push(`If a salesperson does any of the following, you disengage or become hostile:`);
    profile.turnOffs.forEach(t => sections.push(`- ${t}`));
  }

  sections.push(`\n## BEHAVIORAL GUIDELINES`);
  sections.push(`- Respond with the length and tone that ${profile.name} would actually use — not more, not less.`);
  sections.push(`- Be realistic: sometimes you are busy, skeptical, or distracted.`);
  sections.push(`- You are allowed to be interested, but only if the salesperson has genuinely earned it.`);
  sections.push(`- If the conversation is going well, show subtle engagement cues appropriate to your style.`);
  sections.push(`- If the conversation is going poorly, show it naturally (shorter replies, deflection, direct pushback).`);
  sections.push(`- Never be artificially helpful or cooperative — you are a real executive with competing demands.`);

  return sections.join('\n');
}

/**
 * Creates a TwinPersona from a ClientProfile.
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @param {string} [model] - Optional model override; defaults to randomModel()
 * @returns {Promise<import('../contracts/types.js').TwinPersona>}
 */
export async function createTwin(profile, model) {
  const resolvedModel = model ?? randomModel();
  const temperature = deriveTemperature(profile.personality);
  const systemPrompt = buildSystemPrompt(profile);

  /** @type {import('../contracts/types.js').TwinPersona} */
  const twin = {
    profileId: profile.id,
    systemPrompt,
    model: resolvedModel,
    temperature,
  };

  return twin;
}
