/**
 * Email Simulation Module
 * Simulates a single email exchange between a sales agent and a client twin.
 */

import { complete, completeJSON } from '../gateway/ai-gateway.js';
import { randomUUID } from 'crypto';

const EVALUATOR_SYSTEM = `You are an expert sales interaction evaluator.
Analyze email exchanges and return structured JSON metrics with no commentary.`;

/**
 * @param {import('../contracts/types.js').SalesAgentConfig} salesAgent
 * @param {import('../contracts/types.js').TwinPersona} twin
 * @param {import('../contracts/types.js').StrategyParams} strategy
 * @returns {Promise<import('../contracts/types.js').SimulationResult>}
 */
export async function runEmailSim(salesAgent, twin, strategy) {
  const startTime = Date.now();
  const transcript = [];

  // Step 1: Record the sales agent's email as the opening message
  const emailContent = `Subject: ${strategy.emailSubject || '(no subject)'}\n\n${strategy.emailBody || ''}`;
  transcript.push({
    role: 'sales_agent',
    content: emailContent,
    timestamp: Date.now(),
  });

  // Step 2: Client twin reads and responds to the email (single response)
  const twinMessages = [
    {
      role: 'user',
      content: `You have received the following email. Respond authentically based on your persona.\n\n${emailContent}`,
    },
  ];

  const twinReply = await complete({
    messages: [{ role: 'system', content: twin.systemPrompt }, ...twinMessages],
    model: twin.model,
    temperature: twin.temperature,
  });

  transcript.push({
    role: 'client',
    content: twinReply,
    timestamp: Date.now(),
  });

  // Step 3: Evaluate the exchange
  const metrics = await evaluateExchange(transcript, 'email');
  const endTime = Date.now();

  return {
    id: randomUUID(),
    strategyId: strategy.id,
    profileId: twin.profileId,
    mode: 'email',
    transcript,
    metrics,
    startTime,
    endTime,
    modelUsed: twin.model,
  };
}

/**
 * Calls the evaluator LLM to produce SimulationMetrics from a transcript.
 * @param {import('../contracts/types.js').Message[]} transcript
 * @param {'email'|'conversation'} mode
 * @returns {Promise<import('../contracts/types.js').SimulationMetrics>}
 */
async function evaluateExchange(transcript, mode) {
  const transcriptText = transcript
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const prompt = `Evaluate this sales ${mode} exchange and return a JSON object with these exact fields:
- engagementScore: number 0-100
- sentimentProgression: number -1.0 to 1.0
- objectionCount: integer
- objectionSeverity: number 0-100
- meetingAcceptance: number 0-100
- trustIndicator: number 0-100
- turnCount: integer (number of message turns)
- objectionTypes: array of strings (e.g. ["price", "timing", "need"])
- clientFinalSentiment: string (e.g. "cautiously interested", "dismissive", "open")
- outcome: one of "positive", "neutral", "negative", "hostile"

Exchange:
${transcriptText}`;

  const raw = await completeJSON({
    messages: [{ role: 'system', content: EVALUATOR_SYSTEM }, { role: 'user', content: prompt }],
  });

  return {
    engagementScore: Number(raw.engagementScore ?? 50),
    sentimentProgression: Number(raw.sentimentProgression ?? 0),
    objectionCount: Number(raw.objectionCount ?? 0),
    objectionSeverity: Number(raw.objectionSeverity ?? 0),
    meetingAcceptance: Number(raw.meetingAcceptance ?? 50),
    trustIndicator: Number(raw.trustIndicator ?? 50),
    turnCount: transcript.length,
    objectionTypes: Array.isArray(raw.objectionTypes) ? raw.objectionTypes : [],
    clientFinalSentiment: raw.clientFinalSentiment ?? 'neutral',
    outcome: raw.outcome ?? 'neutral',
  };
}

export { evaluateExchange };
