import { describe, expect, it } from 'vitest';

import { evaluateTransaction, type GuardPolicy } from '../src/guard.ts';

const policy: GuardPolicy = {
  maxPerTxWei: 100_000_000_000_000n,
  allowedRecipients: ['0x1111111111111111111111111111111111111111'],
};

describe('AgentGuard policy evaluation', () => {
  it('allows a valid transaction', () => {
    const decision = evaluateTransaction(
      100_000_000_000_000n,
      '0x1111111111111111111111111111111111111111',
      policy,
    );

    expect(decision).toMatchObject({
      status: 'ALLOWED',
    });
    expect(decision.checks).toHaveLength(4);
    expect(decision.checks.every((check) => check.ok)).toBe(true);
  });

  it('blocks a disallowed recipient', () => {
    const decision = evaluateTransaction(
      100_000_000_000_000n,
      '0x9999999999999999999999999999999999999999',
      policy,
    );

    expect(decision).toMatchObject({
      status: 'BLOCKED',
      reason: 'recipient not allowed',
    });
    expect(decision.checks.at(-1)).toMatchObject({
      label: 'Recipient is allowlisted',
      ok: false,
    });
  });

  it('blocks an amount above the policy limit', () => {
    const decision = evaluateTransaction(
      200_000_000_000_000n,
      '0x1111111111111111111111111111111111111111',
      policy,
    );

    expect(decision).toMatchObject({
      status: 'BLOCKED',
      reason: 'amount exceeds limit',
    });
    expect(decision.checks.at(-1)).toMatchObject({
      label: 'Amount is within maxPerTxWei',
      ok: false,
    });
  });
});
