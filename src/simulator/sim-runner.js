/**
 * Simulation Runner
 * Orchestrates running many simulations in parallel with batched concurrency.
 */

import { runEmailSim } from './email-sim.js';
import { runConversationSim } from './conversation-sim.js';

/**
 * @typedef {{ salesAgent: import('../contracts/types.js').SalesAgentConfig, twin: import('../contracts/types.js').TwinPersona, strategy: import('../contracts/types.js').StrategyParams }} SimConfig
 */

/**
 * Runs a single simulation based on mode.
 * @param {SimConfig} config
 * @param {import('../contracts/types.js').SimulationMode} mode
 * @returns {Promise<import('../contracts/types.js').SimulationResult>}
 */
async function runOne(config, mode) {
  const { salesAgent, twin, strategy } = config;
  if (mode === 'email') {
    return runEmailSim(salesAgent, twin, strategy);
  }
  return runConversationSim(salesAgent, twin, strategy);
}

/**
 * Process an array of async tasks with bounded concurrency.
 * @template T
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} concurrency
 * @returns {Promise<Array<T | null>>}
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Runs a batch of simulations with bounded concurrency and progress logging.
 * Individual failures are caught, logged, and skipped.
 *
 * @param {SimConfig[]} simConfigs
 * @param {import('../contracts/types.js').SimulationMode} mode
 * @param {number} [concurrency=10]
 * @returns {Promise<import('../contracts/types.js').SimulationResult[]>}
 */
export async function runBatch(simConfigs, mode, concurrency = 10) {
  const total = simConfigs.length;
  let completed = 0;

  const tasks = simConfigs.map((config, i) => async () => {
    console.log(`Running simulation ${i + 1}/${total}...`);
    try {
      const result = await runOne(config, mode);
      completed++;
      console.log(`Simulation ${i + 1}/${total} done (${completed}/${total} complete).`);
      return result;
    } catch (err) {
      completed++;
      console.error(`Simulation ${i + 1}/${total} failed: ${err?.message ?? err}`);
      return null;
    }
  });

  const raw = await runWithConcurrency(tasks, concurrency);

  // Filter out failed (null) results
  return raw.filter(Boolean);
}
