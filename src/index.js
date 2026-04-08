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
import { scrapeProspect } from './scraper/prospect-scraper.js';

// ---- CLI Arg Parsing ----

function parseArgs(argv) {
  const args = {
    mode: null,
    count: 50,
    concurrency: 10,
    profile: null,
    output: null,
    scrape: null,       // --scrape <json>     Inline JSON ScrapeRequest
    linkedin: null,     // --linkedin <url>     LinkedIn URL shorthand
    discover: null,     // --discover <name>    Discover by name
    company: null,      // --company <name>     Company for discovery
    twitter: null,      // --twitter <handle>   Twitter handle
    website: null,      // --website <url>      Website URL
    noCache: false,     // --no-cache           Skip cache
    cacheTtl: 7,        // --cache-ttl <days>   Cache TTL
    saveScrape: null,   // --save-scrape <path> Save scraped data
    dryRun: false,      // --dry-run            Preview what would be scraped
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
      case '--scrape':    args.scrape = argv[++i]; break;
      case '--linkedin':  args.linkedin = argv[++i]; break;
      case '--discover':  args.discover = argv[++i]; break;
      case '--company':   args.company = argv[++i]; break;
      case '--twitter':   args.twitter = argv[++i]; break;
      case '--website':   args.website = argv[++i]; break;
      case '--no-cache':  args.noCache = true; break;
      case '--cache-ttl': args.cacheTtl = parseInt(argv[++i], 10); break;
      case '--save-scrape': args.saveScrape = argv[++i]; break;
      case '--dry-run':   args.dryRun = true; break;
    }
  }
  return args;
}

function validateArgs(args) {
  const hasScrapeSource = args.scrape || args.linkedin || args.discover;
  if (!args.profile && !hasScrapeSource) {
    console.error('Error: provide --profile <path>, --linkedin <url>, --discover <name>, or --scrape <json>');
    process.exit(1);
  }
  // --mode and --output only required when NOT using --save-scrape alone
  if (!args.saveScrape || args.mode) {
    if (!args.mode || !['email', 'conversation'].includes(args.mode)) {
      console.error('Error: --mode must be "email" or "conversation"');
      process.exit(1);
    }
    if (!args.output) {
      console.error('Error: --output <path> is required');
      process.exit(1);
    }
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

  const hasScrapeSource = args.scrape || args.linkedin || args.discover;
  if (hasScrapeSource) {
    console.log(`Scrape mode: ${args.scrape ? 'inline JSON' : args.linkedin ? 'LinkedIn' : 'discovery'}`);
  }

  // Step 1: Get raw client data (from file OR scrape)
  let rawData;

  if (hasScrapeSource) {
    // Build ScrapeRequest
    let scrapeRequest;
    if (args.scrape) {
      try {
        scrapeRequest = JSON.parse(args.scrape);
      } catch (err) {
        console.error(`Error parsing --scrape JSON: ${err.message}`);
        process.exit(1);
      }
    } else if (args.linkedin) {
      scrapeRequest = { name: 'Unknown', linkedinUrl: args.linkedin };
    } else if (args.discover) {
      scrapeRequest = { name: args.discover };
    }

    // Enrich with optional flags
    if (args.company) scrapeRequest.company = args.company;
    if (args.twitter) scrapeRequest.twitterHandle = args.twitter;
    if (args.website) scrapeRequest.websiteUrl = args.website;

    console.log(`[1/9] Scraping prospect data for: ${scrapeRequest.name || 'Unknown'}...`);
    const scrapeResult = await scrapeProspect(scrapeRequest, {
      noCache: args.noCache,
      cacheTtl: args.cacheTtl,
      dryRun: args.dryRun,
    });

    if (args.dryRun) {
      console.log('Dry run complete. No data scraped.');
      process.exit(0);
    }

    rawData = scrapeResult.assembled;
    console.log(`      Scraped ${scrapeResult.totalSources} sources for: ${rawData.name}`);

    // Optionally save scraped data
    if (args.saveScrape) {
      writeFileSync(args.saveScrape, JSON.stringify(rawData, null, 2));
      console.log(`      Saved scraped data to: ${args.saveScrape}`);
    }

    // If save-only mode (no --mode), exit here
    if (!args.mode) {
      console.log('Scrape-only mode. Use --mode to run simulation.');
      process.exit(0);
    }
  } else {
    console.log('[1/7] Reading client profile data...');
    try {
      rawData = JSON.parse(readFileSync(args.profile, 'utf8'));
    } catch (err) {
      console.error(`Error reading profile file: ${err.message}`);
      process.exit(1);
    }
  }

  const totalSteps = hasScrapeSource ? 9 : 7;
  const stepOffset = hasScrapeSource ? 2 : 0;

  // Step 2: Build client profile
  console.log(`[${2 + stepOffset}/${totalSteps}] Building client profile...`);
  const profile = await buildProfile(rawData);
  console.log(`      Profile built for: ${profile.name} (${profile.company})`);

  // Step 3: Create digital twin
  console.log(`[${3 + stepOffset}/${totalSteps}] Creating digital twin...`);
  const twin = await createTwin(profile);
  console.log(`      Twin created with model: ${twin.model}`);

  // Step 4: Generate strategies
  console.log(`[${4 + stepOffset}/${totalSteps}] Generating ${args.count} ${args.mode} strategies...`);
  const strategies = await generateStrategies(args.mode, args.count, profile);
  console.log(`      Generated ${strategies.length} strategies`);

  // Step 5: Build sales agent configs for each strategy
  console.log(`[${5 + stepOffset}/${totalSteps}] Building sales agent configurations...`);
  const agentConfigs = await Promise.all(
    strategies.map(strategy => buildSalesAgent(strategy, profile))
  );
  console.log(`      Built ${agentConfigs.length} agent configs`);

  // Step 6: Run all simulations
  console.log(`[${6 + stepOffset}/${totalSteps}] Running ${strategies.length} simulations (concurrency=${args.concurrency})...`);
  const simPairs = strategies.map((strategy, i) => ({
    salesAgent: agentConfigs[i],
    twin,
    strategy,
  }));
  const results = await runBatch(simPairs, args.mode, args.concurrency);
  console.log(`      Completed ${results.length} simulations`);

  // Step 7: Analyze results
  console.log(`[${7 + stepOffset}/${totalSteps}] Analyzing results...`);
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
