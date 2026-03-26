#!/usr/bin/env node
/**
 * End-to-End Test Script
 * ======================
 * Runs a small simulation with sample data for Alex Chen at TechVentures Inc.
 * Proves the system works end-to-end with 5 email strategies.
 */

import { buildProfile } from './profiler/profile-builder.js';
import { createTwin } from './twin-engine/twin-builder.js';
import { generateStrategies, buildSalesAgent } from './strategy-engine/strategy-gen.js';
import { runBatch } from './simulator/sim-runner.js';
import { analyze } from './analyzer/result-analyzer.js';

// ---- Sample Data ----

const sampleClientData = {
  name: 'Alex Chen',
  title: 'Chief Technology Officer',
  company: 'TechVentures Inc',
  industry: 'SaaS/B2B',
  linkedinPosts: [
    'Excited to share that we just deployed our first internal AI assistant across the engineering org. The productivity gains are real -- 30% faster PR reviews and significantly reduced time debugging. AI adoption is no longer a question of "if" but "how fast". If you\'re not building your team\'s AI fluency today, you\'re already behind.',
    'We\'ve grown from 45 to 120 engineers in 18 months. The biggest challenge isn\'t hiring -- it\'s maintaining culture and code quality at scale. We\'ve invested heavily in platform tooling, but the real unlock has been ruthless documentation standards and async-first communication. Happy to share our internal playbook if anyone is going through the same pain.',
    'Operational efficiency update: we cut our cloud costs by 40% this quarter by right-sizing our Kubernetes clusters and moving batch workloads to spot instances. Sometimes the best engineering work is the invisible kind -- the stuff that just quietly saves money. The team deserves huge credit for this initiative.',
    'Controversial take: most SaaS "AI features" are demos in search of a use case. The companies that will win are those that deeply integrate AI into their core workflow loops, not bolt it on as a marketing checkbox. We\'re being intentional about which bets we\'re making. Quality over quantity.',
  ],
  companyInfo: [
    'TechVentures Inc is a Series B SaaS company focused on B2B workflow automation.',
    'Recent funding: $45M Series B closed 8 months ago.',
    'Currently scaling engineering from 120 to 200 engineers over next 12 months.',
  ],
};

// ---- Test Runner ----

async function runTest() {
  const startTime = Date.now();
  console.log('\n=== Sales Simulator End-to-End Test ===');
  console.log('Target: Alex Chen, CTO at TechVentures Inc (SaaS/B2B)');
  console.log('Config: 5 email strategies, concurrency=2\n');

  // Step 1: Build profile
  console.log('[1/6] Building client profile...');
  const profile = await buildProfile(sampleClientData);
  console.log(`      Profile ID: ${profile.id}`);
  console.log(`      Communication Style: ${profile.communicationStyle}`);
  console.log(`      Pain Points: ${(profile.painPoints || []).slice(0, 2).join(', ')}`);

  // Step 2: Create digital twin
  console.log('[2/6] Creating digital twin...');
  const twin = await createTwin(profile);
  console.log(`      Twin model: ${twin.model}`);

  // Step 3: Generate strategies
  console.log('[3/6] Generating 5 email strategies...');
  const strategies = await generateStrategies('email', 5, profile);
  console.log(`      Generated ${strategies.length} strategies`);

  // Step 4: Build agent configs
  console.log('[4/6] Building sales agent configs...');
  const agentConfigs = await Promise.all(
    strategies.map(s => buildSalesAgent(s, profile))
  );

  // Step 5: Run simulations
  console.log('[5/6] Running simulations (concurrency=2)...');
  const simPairs = strategies.map((strategy, i) => ({
    salesAgent: agentConfigs[i],
    twin,
    strategy,
  }));
  const results = await runBatch(simPairs, 'email', 2);
  console.log(`      Completed ${results.length} simulations`);

  // Step 6: Analyze
  console.log('[6/6] Analyzing results...');
  const report = await analyze(results, profile);

  // Print results
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n========== TEST RESULTS ==========');
  console.log(`Total time: ${elapsed}s`);
  console.log(`Simulations run: ${report.totalSimulations}`);

  if (report.rankings.length > 0) {
    const top = report.rankings[0];
    console.log('\nTop Strategy:');
    console.log(`  ID: ${top.strategyId}`);
    console.log(`  Win Rate: ${top.winRate.toFixed(1)}%`);
    console.log(`  Avg Engagement: ${top.avgEngagement.toFixed(1)}`);
    console.log(`  Avg Meeting Acceptance: ${top.avgMeetingAcceptance.toFixed(1)}`);
    console.log(`  Avg Trust: ${top.avgTrust.toFixed(1)}`);
    console.log(`  Avg Objections: ${top.avgObjections.toFixed(1)}`);
    console.log(`  Sample Size: ${top.sampleSize}`);
  }

  if (report.insights && report.insights.length > 0) {
    console.log('\nKey Insights:');
    for (const insight of report.insights) {
      console.log(`  - ${insight}`);
    }
  }

  const objEntries = Object.entries(report.commonObjections);
  if (objEntries.length > 0) {
    console.log('\nCommon Objections:');
    objEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([type, count]) => console.log(`  - ${type}: ${count}x`));
  }

  console.log('\nAll strategy rankings:');
  for (const r of report.rankings) {
    const winIcon = r.winRate >= 50 ? '+' : r.winRate >= 25 ? '~' : '-';
    console.log(
      `  [${winIcon}] #${r.rank} ${r.strategyId}: WinRate=${r.winRate.toFixed(0)}% ` +
      `Engage=${r.avgEngagement.toFixed(0)} Trust=${r.avgTrust.toFixed(0)}`
    );
  }

  console.log('\n[PASS] End-to-end test completed successfully.');
  console.log('==================================\n');
}

runTest().catch(err => {
  console.error('\n[FAIL] Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
