# Testing

AgentGuard currently keeps testing intentionally narrow and focused on the control decision path.

The goal at this stage is not broad coverage. The goal is deterministic proof that the core policy engine behaves predictably for the main allow and deny cases.

## Commands

Run the automated test suite once:

```bash
npm test
```

Run the test suite in watch mode while iterating:

```bash
npm run test:watch
```

Run TypeScript verification separately:

```bash
npm run typecheck
```

## Current Coverage

The current automated suite lives in [`test/guard.test.ts`](test/guard.test.ts).

It verifies:

- a valid transaction is allowed
- a recipient outside the allowlist is blocked
- an amount above `maxPerTxWei` is blocked

These tests exercise the structured decision surface returned by [`src/guard.ts`](src/guard.ts), which is the core logic behind the CLI.

## What Is Not Covered Yet

The current suite does not yet cover:

- CLI argument parsing in [`src/index.ts`](src/index.ts)
- policy file loading from [`policy.json`](policy.json)
- audit log writes in [`src/logging.ts`](src/logging.ts)
- real AgentPay execution in [`src/agentpay.ts`](src/agentpay.ts)

That is intentional for now. The highest-value risk in this repo is the correctness of the policy decision, so that is where the first automated tests are concentrated.

## How To Extend The Suite

The next useful additions would be:

1. CLI tests for `--dry-run` and `--explain`
2. policy-loading tests for malformed or missing `policy.json`
3. logging tests that verify one JSON record is written per decision
4. integration tests for the real AgentPay path once `agentpay` is installed locally

## Test Philosophy

This project is a control layer, not a UI-first app.

That means the most important test question is:

**Does AgentGuard make the right decision for a proposed transaction?**

Everything else matters after that.
