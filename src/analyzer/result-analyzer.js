/**
 * Result Analyzer Module
 * ======================
 * Contract: analyze(results, profile) -> Promise<AnalysisReport>
 * Groups results by strategy, ranks them, and uses AI to generate insights + playbook.
 */

import { complete, completeJSON } from '../gateway/ai-gateway.js';

/**
 * @param {import('../contracts/types.js').SimulationResult[]} results
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @returns {Promise<import('../contracts/types.js').AnalysisReport>}
 */
export async function analyze(results, profile) {
  if (!results || results.length === 0) {
    throw new Error('No simulation results to analyze');
  }

  // Step 1: Group results by strategyId
  const groups = groupByStrategy(results);

  // Step 2: Calculate stats per strategy
  const rankings = buildRankings(groups);

  // Step 3: Aggregate objection types across all sims
  const commonObjections = aggregateObjections(results);

  // Step 4: AI insights (top vs bottom strategies)
  const { insights, playbook } = await generateAIContent(rankings, profile, commonObjections);

  const bestStrategy = rankings[0] || null;

  return {
    profileId: profile.id,
    mode: results[0].mode,
    totalSimulations: results.length,
    rankings,
    commonObjections,
    insights,
    bestStrategy,
    playbook,
    analysisTimestamp: Date.now(),
  };
}

/**
 * Group simulation results by strategyId
 * @param {import('../contracts/types.js').SimulationResult[]} results
 * @returns {Map<string, import('../contracts/types.js').SimulationResult[]>}
 */
function groupByStrategy(results) {
  const groups = new Map();
  for (const result of results) {
    if (!groups.has(result.strategyId)) {
      groups.set(result.strategyId, []);
    }
    groups.get(result.strategyId).push(result);
  }
  return groups;
}

/**
 * Build ranked StrategyRanking[] from grouped results
 * @param {Map<string, import('../contracts/types.js').SimulationResult[]>} groups
 * @returns {import('../contracts/types.js').StrategyRanking[]}
 */
function buildRankings(groups) {
  const rankings = [];

  for (const [strategyId, sims] of groups.entries()) {
    const sampleSize = sims.length;
    const positives = sims.filter(s => s.metrics.outcome === 'positive').length;
    const winRate = sampleSize > 0 ? (positives / sampleSize) * 100 : 0;

    const avg = (key) => sims.reduce((sum, s) => sum + s.metrics[key], 0) / sampleSize;

    rankings.push({
      strategyId,
      rank: 0, // assigned below
      winRate: Math.round(winRate * 100) / 100,
      avgEngagement: Math.round(avg('engagementScore') * 100) / 100,
      avgMeetingAcceptance: Math.round(avg('meetingAcceptance') * 100) / 100,
      avgTrust: Math.round(avg('trustIndicator') * 100) / 100,
      avgObjections: Math.round(avg('objectionCount') * 100) / 100,
      sampleSize,
    });
  }

  // Sort by winRate desc, then avgMeetingAcceptance desc as tiebreaker
  rankings.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.avgMeetingAcceptance - a.avgMeetingAcceptance;
  });

  // Assign rank
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

/**
 * Aggregate all objection types from all simulations
 * @param {import('../contracts/types.js').SimulationResult[]} results
 * @returns {Object} {type: count}
 */
function aggregateObjections(results) {
  const counts = {};
  for (const result of results) {
    for (const objType of (result.metrics.objectionTypes || [])) {
      counts[objType] = (counts[objType] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Use AI gateway to generate insights and playbook
 * @param {import('../contracts/types.js').StrategyRanking[]} rankings
 * @param {import('../contracts/types.js').ClientProfile} profile
 * @param {Object} commonObjections
 * @returns {Promise<{insights: string[], playbook: string}>}
 */
async function generateAIContent(rankings, profile, commonObjections) {
  const top3 = rankings.slice(0, 3);
  const bottom3 = rankings.slice(-3);
  const topObjections = Object.entries(commonObjections)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type} (${count}x)`)
    .join(', ');

  const contextBlock = `
Client Profile:
- Name: ${profile.name}, Title: ${profile.title}, Company: ${profile.company}
- Communication Style: ${profile.communicationStyle}
- Pain Points: ${(profile.painPoints || []).join(', ')}
- Persuasion Triggers: ${(profile.persuasionTriggers || []).join(', ')}
- Objection Patterns: ${(profile.objectionPatterns || []).join(', ')}

Top Strategies:
${top3.map(r => `  #${r.rank}: ID=${r.strategyId}, WinRate=${r.winRate}%, Engagement=${r.avgEngagement}, MeetingAccept=${r.avgMeetingAcceptance}, Trust=${r.avgTrust}`).join('\n')}

Bottom Strategies:
${bottom3.map(r => `  #${r.rank}: ID=${r.strategyId}, WinRate=${r.winRate}%, Engagement=${r.avgEngagement}`).join('\n')}

Most Common Objections: ${topObjections || 'none recorded'}
`.trim();

  // Generate insights
  const insightsRaw = await completeJSON({
    messages: [
      {
        role: 'user',
        content: `You are a sales strategy expert. Based on simulation data, generate 3-5 tactical insights explaining what made the top strategies outperform the bottom ones, and how to handle this client.

${contextBlock}

Return JSON: { "insights": ["insight1", "insight2", ...] }`,
      },
    ],
    temperature: 0.5,
    maxTokens: 1024,
  });

  const insights = Array.isArray(insightsRaw.insights) ? insightsRaw.insights : [];

  // Generate playbook
  const playbookText = await complete({
    messages: [
      {
        role: 'user',
        content: `You are a sales coach. Write a concise sales playbook (2-4 paragraphs) for approaching ${profile.name} at ${profile.company}. Include: the optimal opening approach, how to frame the value proposition, prepared responses to their top objections (${topObjections}), and the ideal close.

${contextBlock}`,
      },
    ],
    temperature: 0.6,
    maxTokens: 800,
  });

  return { insights, playbook: playbookText };
}
