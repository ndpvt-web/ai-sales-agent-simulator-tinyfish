# AI Sales Agent Simulator

**The open-source AI sales agent that simulates hundreds of sales conversations before you send a single email.**

Build a psychological digital twin of any prospect from their public data, then run Monte Carlo simulations across hundreds of parameterized sales strategies to find the exact approach that converts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Why This Exists

Every sales rep sends the same templated cold email to every prospect. The response rate is 1-3%. What if you could simulate the conversation first?

This AI sales agent builds a behavioral model of your prospect -- their personality (Big Five), communication style, decision patterns, objection triggers -- then stress-tests hundreds of different sales approaches against that model. Before you ever hit send, you know which opening line, value frame, urgency level, and emotional tone will land.

**Stop guessing. Start simulating.**

## What It Does

1. **Profile** -- Feed in public data (LinkedIn posts, tweets, blog posts, company info). The AI sales agent analyzes it using Big Five personality modeling and MBTI-derived behavioral analysis to build a structured client profile.

2. **Twin** -- Converts the profile into a digital twin: an LLM-powered agent that responds like your prospect would. It mirrors their communication style, objection patterns, values, and decision-making process.

3. **Strategize** -- Generates hundreds of parameterized sales strategy variations using Latin Hypercube Sampling across 5-6 dimensions: opening style, value frame, urgency level, emotional tone, objection handling, and (for calls) closing technique.

4. **Simulate** -- Runs every strategy against the digital twin. Email mode simulates a cold email + response. Conversation mode simulates a full multi-turn sales call with natural turn-taking and termination detection.

5. **Analyze** -- Ranks all strategies by win rate, engagement score, meeting acceptance likelihood, and trust indicators. Generates tactical insights and a ready-to-use sales playbook.

## Quick Start

```bash
git clone https://github.com/ndpvt-web/ai-sales-agent-simulator.git
cd ai-sales-agent-simulator

# Set your OpenAI-compatible API key
export AI_GATEWAY_API_KEY="your-api-key"

# Create a prospect profile (see examples/prospect.json)
node src/index.js \
  --mode email \
  --count 100 \
  --concurrency 10 \
  --profile examples/prospect.json \
  --output results/report.json
```

### Conversation Mode (Simulate a Sales Call)

```bash
node src/index.js \
  --mode conversation \
  --count 50 \
  --concurrency 5 \
  --profile examples/prospect.json \
  --output results/call-report.json
```

## Example Prospect File

```json
{
  "name": "Alex Chen",
  "title": "CTO",
  "company": "TechVentures Inc",
  "industry": "Enterprise SaaS",
  "linkedinPosts": [
    "Just shipped our new microservices architecture. 6 months of work, but the scalability gains are worth it.",
    "Hot take: most AI products are solutions looking for problems. Start with the user pain point.",
    "Proud of the team for hitting 99.99% uptime this quarter. Reliability is a feature.",
    "Reading 'Thinking in Systems' by Donella Meadows. Every engineer should read this."
  ],
  "tweets": [
    "The best technical decisions are the boring ones.",
    "Hiring: looking for engineers who ask 'why' before 'how'."
  ],
  "companyInfo": [
    "TechVentures raised Series B ($45M) in Q3 2025",
    "Expanding enterprise sales team, targeting Fortune 500"
  ]
}
```

## Output

The simulator produces a ranked report with:

- **Strategy rankings** sorted by win rate, engagement, meeting acceptance, and trust scores
- **Tactical insights** identifying which combinations of tone, framing, and urgency work best for this specific prospect
- **Objection analysis** cataloging what pushback to expect and how to handle it
- **Ready-to-use playbook** with the optimal email or call script

```
========== SUMMARY ==========
Total simulations: 100
Total time: 47.3s

Top 5 Strategies:
  #1 [strat-2024-warm-roi] WinRate=78.0% | Engagement=82.1 | MeetingAccept=71.3 | Trust=76.5 | n=4
  #2 [strat-2024-data-risk] WinRate=72.0% | Engagement=79.4 | MeetingAccept=68.1 | Trust=73.2 | n=4
  #3 [strat-2024-peer-comp] WinRate=68.0% | Engagement=75.8 | MeetingAccept=64.7 | Trust=70.1 | n=4
  ...

Key Insights:
  - Warm personal openings with ROI framing outperform provocative approaches for analytical CTOs
  - Low urgency with data-backed claims builds trust faster than high-pressure tactics
  - This prospect responds best to empathetic tone with concrete technical examples
==============================
```

## Architecture

Built with a contract-first, modular architecture. Every module communicates through typed interfaces defined in `src/contracts/types.js`. Swap any component without touching the others.

```
src/
  contracts/types.js          # The source of truth -- all interfaces
  gateway/ai-gateway.js       # LLM abstraction (OpenAI-compatible)
  profiler/profile-builder.js # Raw data -> ClientProfile
  twin-engine/twin-builder.js # ClientProfile -> Digital Twin
  strategy-engine/
    strategy-gen.js            # Latin Hypercube strategy generation
    templates/
      email-strategies.js      # Email parameter space
      conversation-strategies.js # Conversation parameter space
  simulator/
    email-sim.js               # Single email simulation
    conversation-sim.js        # Multi-turn call simulation
    sim-runner.js              # Bounded-concurrency batch runner
  analyzer/result-analyzer.js  # Statistical analysis + AI insights
  index.js                     # CLI entry point (7-step pipeline)
```

### Multi-Model Diversity

The simulator uses multiple LLM providers (Claude, GPT, Gemini) randomly per simulation to avoid model-specific conversational equilibria. This produces more realistic and robust strategy rankings.

### Founding Axioms

This system is built on Aristotelian first principles:

- **A1: Know the soul** -- All persuasion begins with understanding the individual
- **A2: The twin IS the test** -- A digital twin faithful to the profile IS the simulation
- **A3: Intelligence cannot be templated** -- Every strategy must be generated, not copied
- **A4: Volume reveals truth** -- Statistical significance requires hundreds of simulations
- **A5: Modules are atoms** -- Each component is independently replaceable
- **A6: Contracts are law** -- Modules communicate only through defined interfaces

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--mode` | `email` or `conversation` | required |
| `--count` | Number of strategy variations to generate | `50` |
| `--concurrency` | Max parallel simulations | `10` |
| `--profile` | Path to prospect JSON file | required |
| `--output` | Path for output report JSON | required |

## API Compatibility

Works with any OpenAI-compatible API endpoint. Set your provider:

```bash
# OpenAI
export AI_GATEWAY_API_KEY="sk-..."

# Anthropic (via OpenAI-compatible proxy)
export AI_GATEWAY_API_KEY="your-key"

# Any OpenRouter-compatible endpoint
export AI_GATEWAY_API_KEY="your-key"
```

The gateway abstraction in `src/gateway/ai-gateway.js` handles all provider differences transparently.

## Use Cases

- **Sales teams** -- Find the optimal cold outreach strategy for high-value prospects before sending
- **Sales enablement** -- Generate data-driven playbooks for new reps targeting specific verticals
- **Account executives** -- Simulate pre-call preparation for important meetings
- **SDR managers** -- A/B test messaging strategies without burning real prospects
- **Sales training** -- Practice against realistic AI-powered prospect simulations
- **GTM teams** -- Validate positioning and messaging before launch

## Roadmap

- [ ] Web dashboard for interactive simulation results
- [ ] CRM integration (Salesforce, HubSpot) for automatic prospect data ingestion
- [ ] Real-time conversation coaching mode
- [ ] Team-wide strategy optimization across prospect segments
- [ ] Fine-tuned twin models for specific industries

---

## Proudly Sponsored by HappyCapy

This AI sales agent simulator is proudly sponsored by **[HappyCapy](https://happycapy.ai)** -- the platform for building and deploying specialized AI agents.

HappyCapy will continue releasing specialized AI agents like this one. From sales to research to operations, each agent is purpose-built, modular, and production-ready.

**Stay tuned for more specialized agents from HappyCapy. Follow us for updates.**

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Keywords:** ai sales agent, sales simulator, ai sales tool, sales strategy optimization, digital twin sales, cold email optimization, ai prospecting, sales automation, ai outreach, conversation simulator, sales call simulator, monte carlo sales, ai sales strategy, sales agent ai, ai powered sales, automated sales agent, sales ai tool, ai cold outreach, sales optimization software, ai sales assistant
