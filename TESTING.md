# Testing

AgentGuard keeps testing intentionally focused on the core control layer: policy validation and decision logging.

## Commands

Run the automated test suite:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

## Current Coverage

The current automated suite lives in `test/guard.test.ts`.

It verifies:

- valid transactions are allowed
- disallowed recipients are blocked
- transactions exceeding limits are blocked

These tests exercise the core policy engine in `src/guard.ts`.

## Policy + Logging Coverage

AgentGuard also validates configuration loading and audit logging.

Coverage includes:

- loading `policy.json` and applying limits/allowlists
- handling malformed or missing `policy.json`
- writing one structured audit record per decision to `logs/decisions.log`

Expected behavior:

- valid config → transaction evaluated normally
- missing/invalid config → safe failure (no execution)
- every ALLOWED / BLOCKED decision → one log entry

## What Is Not Covered Yet

- CLI argument parsing in `src/index.ts`
- real AgentPay execution in `src/agentpay.ts`

Policy loading and logging are covered at a basic level; deeper edge-case and integration testing can be added incrementally.

## How To Extend The Suite

Next useful additions:

1. CLI tests for `--dry-run` and `--explain`
2. advanced policy-loading tests (edge cases, partial configs, overrides)
3. structured logging tests (schema validation, rotation, failure handling)
4. integration tests for real AgentPay execution once installed locally

## Test Philosophy

AgentGuard is a control layer, not a UI-first application.

The most important question is:

**Does AgentGuard make the correct decision before any transaction is signed?**

Everything else builds on that guarantee.
