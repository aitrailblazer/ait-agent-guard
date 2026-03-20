import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addPendingApproval, clearPendingApprovals } from '../src/store.ts';

describe('state directory resolution', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'agentguard-store-test-'));
    process.env.AGENTGUARD_STATE_DIR = stateDir;
    clearPendingApprovals();
  });

  afterEach(() => {
    clearPendingApprovals();
    rmSync(stateDir, { force: true, recursive: true });
    delete process.env.AGENTGUARD_STATE_DIR;
  });

  it('writes state files to an absolute AGENTGUARD_STATE_DIR', () => {
    addPendingApproval({
      amountWei: '100000000000000',
      createdAt: '2026-03-20T08:00:00.000Z',
      network: '11155111',
      notified: false,
      reason: 'recipient not allowed',
      source: 'api',
      status: 'PENDING',
      to: '0x9999999999999999999999999999999999999999',
      txId: 'tx-store-abs-1',
    });

    expect(existsSync(join(stateDir, 'pending-approvals.json'))).toBe(true);
    expect(
      existsSync(join(process.cwd(), stateDir, 'pending-approvals.json')),
    ).toBe(false);
  });
});
