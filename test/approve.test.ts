import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { executeAgentPayTransferMock } = vi.hoisted(() => ({
  executeAgentPayTransferMock: vi.fn(),
}));

vi.mock('../src/agentpay.ts', () => ({
  AGENTPAY_EXECUTION_MODE: 'auto',
  executeAgentPayTransfer: executeAgentPayTransferMock,
}));

import { approvePendingTransaction } from '../src/approve.ts';
import {
  addPendingApproval,
  clearPendingApprovals,
  getPendingApproval,
} from '../src/store.ts';

describe('pending approval CLI flow', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'agentguard-approve-test-'));
    process.env.AGENTGUARD_STATE_DIR = stateDir;
    executeAgentPayTransferMock.mockReset();
    clearPendingApprovals();
  });

  afterEach(() => {
    clearPendingApprovals();
    rmSync(stateDir, { force: true, recursive: true });
    delete process.env.AGENTGUARD_STATE_DIR;
  });

  it('executes and removes a pending approval by tx id', () => {
    addPendingApproval({
      amountWei: '100000000000000',
      createdAt: '2026-03-20T08:00:00.000Z',
      network: '11155111',
      notified: false,
      reason: 'recipient not allowed',
      source: 'cli',
      status: 'PENDING',
      to: '0x1111111111111111111111111111111111111111',
      txId: 'tx-approval-1',
    });

    executeAgentPayTransferMock.mockReturnValue({
      mode: 'mock',
      raw: '{"ok":true}',
      success: true,
    });

    const result = approvePendingTransaction('tx-approval-1');

    expect(executeAgentPayTransferMock).toHaveBeenCalledWith(
      '0x1111111111111111111111111111111111111111',
      '100000000000000',
      '11155111',
    );
    expect(result).toMatchObject({
      mode: 'mock',
      raw: '{"ok":true}',
    });
    expect(getPendingApproval('tx-approval-1')).toBeUndefined();
  });
});
