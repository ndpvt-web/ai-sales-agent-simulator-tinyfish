# Contributing

Thank you for your interest in contributing to the AI Sales Agent Simulator.

## How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Ensure all modules still communicate through `src/contracts/types.js`
5. Test with `node src/test.js`
6. Commit and push
7. Open a pull request

## Architecture Rules

- All module interfaces are defined in `src/contracts/types.js`. Do not create cross-module imports.
- The gateway abstraction (`src/gateway/ai-gateway.js`) is the only place that touches the LLM API.
- Use named options objects for all gateway calls: `complete({ messages, model, temperature })`.
- Every new module must be independently swappable without changing other modules.

## Reporting Issues

Open an issue with a clear description, expected behavior, and actual behavior.
