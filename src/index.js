#!/usr/bin/env node
/**
 * Sales Strategy Simulator - CLI Entry Point
 * ===========================================
 * Orchestrates the full pipeline: profile -> twin -> strategies -> sims -> analysis
 */

import { readFileSync, writeFileSync } from 'fs';
import { buildProfile } from './profiler/profile-builder.js';
import { createTwin } from './twin-engine/twin-builder.js';
import { generateStrategies, buildSalesAgent } from './strategy-engine/strategy-gen.js';
import { runBatch } from './simulator/sim-runner.js';
import { analyze } from './analyzer/result-analyzer.js';

// ---- CLI Arg Parsing ----

function parseArgs(argv) {
  const args = {
    mode: null,
    count: 50,
    concurrency: 10,
    profile: null,
    output: null,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--mode':
        args.mode = argv[++i];
        break;
      case '--count':
        args.count = parseInt(argv[++i], 10);
        break;
      case '--concurrency':
        args.concurrency = parseInt(argv[++i], 10);
        break;
      case '--profile':
        args.profile = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
    }
  }
  return args;
}

function validateArgs(args) {
  if (!args.mode || !['email', 'conversation'].includes(args.mode)) {
    console.error('Error: --mode must be "email" or "conversation"');
    process.exit(1);
  }
  if (!args.profile) {
    console.error('Error: --profile <path> is required');
    process.exit(1);
  }
  if (!args.output) {
    console.error('Error: --output <path> is required');
    process.exit(1);
  }
  if (isNaN(args.count) || args.count < 1) {
    console.error('Error: --count must be a positive integer');
    process.exit(1);
  }
}

// ---- Main Pipeline ----

async function main() {
  const startTime = Date.now();
  const args = parseArgs(process.argv);
  validateArgs(args);

  console.log(`\n=== Sales Strategy Simulator ===`);
  console.log(`Mode: ${args.mode} | Strategies: ${args.count} | Concurrency: ${args.concurrency}`);
  console.log(`Profile: ${args.profile}`);
  console.log(`Output: ${args.output}\n`);

  // Step 1: Read raw client data
  console.log('[1/7] Reading client profile data...');
  let rawData;
  try {
    rawData = JSON.parse(readFileSync(args.profile, 'utf8'));
  } catch (err) {
    console.error(`Error reading profile file: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Build client profile
  console.log('[2/7] Building client profile...');
  const profile = await buildProfile(rawData);
  console.log(`      Profile built for: ${profile.name} (${profile.company})`);

  // Step 3: Create digital twin
  console.log('[3/7] Creating digital twin...');
  const twin = await createTwin(profile);
  console.log(`      Twin created with model: ${twin.model}`);

  // Step 4: Generate strategies
  console.log(`[4/7] Generating ${args.count} ${args.mode} strategies...`);
  const strategies = await generateStrategies(args.mode, args.count, profile);
  console.log(`      Generated ${strategies.length} strategies`);

  // Step 5: Build sales agent configs for each strategy
  console.log('[5/7] Building sales agent configurations...');
  const agentConfigs = await Promise.all(
    strategies.map(strategy => buildSalesAgent(strategy, profile))
  );
  console.log(`      Built ${agentConfigs.length} agent configs`);

  // Step 6: Run all simulations
  console.log(`[6/7] Running ${strategies.length} simulations (concurrency=${args.concurrency})...`);
  const simPairs = strategies.map((strategy, i) => ({
    salesAgent: agentConfigs[i],
    twin,
    strategy,
  }));
  const results = await runBatch(simPairs, args.mode, args.concurrency);
  console.log(`      Completed ${results.length} simulations`);

  // Step 7: Analyze results
  console.log('[7/7] Analyzing results...');
  const report = await analyze(results, profile);
  console.log(`      Analysis complete. ${report.rankings.length} strategies ranked.`);

  // Save full report
  writeFileSync(args.output, JSON.stringify({ report, results }, null, 2));
  console.log(`\nReport saved to: ${args.output}`);

  // Print summary
  printSummary(report, Date.now() - startTime);
}

function printSummary(report, elapsedMs) {
  const elapsed = (elapsedMs / 1000).toFixed(1);
  console.log('\n========== SUMMARY ==========');
  console.log(`Total simulations: ${report.totalSimulations}`);
  console.log(`Total time: ${elapsed}s`);

  console.log('\nTop 5 Strategies:');
  const top5 = report.rankings.slice(0, 5);
  for (const r of top5) {
    console.log(
      `  #${r.rank} [${r.strategyId}] WinRate=${r.winRate.toFixed(1)}% | ` +
      `Engagement=${r.avgEngagement.toFixed(1)} | ` +
      `MeetingAccept=${r.avgMeetingAcceptance.toFixed(1)} | ` +
      `Trust=${r.avgTrust.toFixed(1)} | n=${r.sampleSize}`
    );
  }

  console.log('\nKey Insights:');
  for (const insight of report.insights) {
    console.log(`  - ${insight}`);
  }

  const topObjections = Object.entries(report.commonObjections)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topObjections.length > 0) {
    console.log('\nTop Objections:');
    for (const [type, count] of topObjections) {
      console.log(`  - ${type}: ${count}x`);
    }
  }
  console.log('==============================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
