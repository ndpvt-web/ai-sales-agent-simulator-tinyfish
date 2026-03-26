/**
 * Conversation Simulation Module
 * Simulates a multi-turn back-and-forth conversation between a sales agent and a client twin.
 */

import { complete } from '../gateway/ai-gateway.js';
import { randomUUID } from 'crypto';
import { evaluateExchange } from './email-sim.js';

// Signals that indicate the conversation has reached a natural end
const END_SIGNALS = [
  /\b(goodbye|bye|take care|talk later|have a good|have a great|thanks for your time)\b/i,
  /\b(not interested|please remove|stop contacting|do not contact)\b/i,
  /\b(let's schedule|send me|i'll review|forward me|set up a meeting|book a call)\b/i,
];

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasConversationEnded(text) {
  return END_SIGNALS.some((pattern) => pattern.test(text));
}

/**
 * Builds the messages array for a participant from the shared transcript.
 * @param {import('../contracts/types.js').Message[]} transcript
 * @param {'sales_agent'|'client'} perspective - whose turn is next
 * @returns {Array<{role:'user'|'assistant', content: string}>}
 */
function buildMessages(transcript, perspective) {
  const messages = [];
  for (const msg of transcript) {
    if (msg.role === perspective) {
      messages.push({ role: 'assistant', content: msg.content });
    } else {
      messages.push({ role: 'user', content: msg.content });
    }
  }
  return messages;
}

/**
 * @param {import('../contracts/types.js').SalesAgentConfig} salesAgent
 * @param {import('../contracts/types.js').TwinPersona} twin
 * @param {import('../contracts/types.js').StrategyParams} strategy
 * @param {number} [maxTurns=10]
 * @returns {Promise<import('../contracts/types.js').SimulationResult>}
 */
export async function runConversationSim(salesAgent, twin, strategy, maxTurns = 10) {
  const startTime = Date.now();
  /** @type {import('../contracts/types.js').Message[]} */
  const transcript = [];

  // Step 1: Sales agent opens the conversation
  const opener = strategy.conversationOpener || 'Hi, I wanted to reach out about something that might be valuable to you.';
  transcript.push({
    role: 'sales_agent',
    content: opener,
    timestamp: Date.now(),
  });

  // Step 2: Conversation loop — alternate between twin and sales agent
  for (let turn = 0; turn < maxTurns; turn++) {
    // --- Twin's turn ---
    const twinMessages = buildMessages(transcript, 'client');
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

    if (hasConversationEnded(twinReply)) {
      break;
    }

    // --- Sales agent's turn ---
    const agentMessages = buildMessages(transcript, 'sales_agent');
    const agentReply = await complete({
      messages: [{ role: 'system', content: salesAgent.systemPrompt }, ...agentMessages],
      model: salesAgent.model,
      temperature: salesAgent.temperature,
    });

    transcript.push({
      role: 'sales_agent',
      content: agentReply,
      timestamp: Date.now(),
    });

    if (hasConversationEnded(agentReply)) {
      break;
    }
  }

  // Step 3: Evaluate the full exchange
  const metrics = await evaluateExchange(transcript, 'conversation');
  const endTime = Date.now();

  return {
    id: randomUUID(),
    strategyId: strategy.id,
    profileId: twin.profileId,
    mode: 'conversation',
    transcript,
    metrics,
    startTime,
    endTime,
    modelUsed: twin.model,
  };
}
