import { mkdtempSync, rmSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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

import { createApp } from '../src/server.ts';
import {
  addPendingApproval,
  clearPendingApprovals,
  getPendingApproval,
  getTransactionRecord,
} from '../src/store.ts';

function createSignedSlackRequestBody(
  payload: Record<string, unknown>,
  options?: {
    secret?: string;
    timestamp?: number;
  },
): {
  body: string;
  headers: Record<string, string>;
} {
  const timestamp = options?.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = options?.secret ?? process.env.SLACK_SIGNING_SECRET ?? '';
  const body = new URLSearchParams({
    payload: JSON.stringify(payload),
  }).toString();
  const signature = `v0=${createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`, 'utf8')
    .digest('hex')}`;

  return {
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': String(timestamp),
      'x-slack-signature': signature,
    },
  };
}

describe('Slack approval actions', () => {
  let baseUrl = '';
  let server: Server;
  let stateDir: string;

  beforeEach(async () => {
    stateDir = mkdtempSync(join(tmpdir(), 'agentguard-slack-actions-'));
    process.env.AGENTGUARD_STATE_DIR = stateDir;
    process.env.SLACK_WEBHOOK_URL = '';
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
    executeAgentPayTransferMock.mockReset();
    clearPendingApprovals();
    server = createApp().listen(0);

    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    clearPendingApprovals();
    rmSync(stateDir, { force: true, recursive: true });
    delete process.env.AGENTGUARD_STATE_DIR;
    delete process.env.SLACK_SIGNING_SECRET;
  });

  it('rejects an invalid Slack signature on /slack/actions', async () => {
    addPendingApproval({
      amountWei: '100000000000000',
      createdAt: '2026-03-20T08:00:00.000Z',
      network: '11155111',
      notified: true,
      reason: 'recipient not allowed',
      source: 'api',
      status: 'PENDING',
      to: '0x1111111111111111111111111111111111111111',
      txId: 'tx-slack-invalid-signature',
    });

    const request = createSignedSlackRequestBody(
      {
        actions: [
          {
            action_id: 'approve_tx',
            value: 'tx-slack-invalid-signature',
          },
        ],
      },
      { secret: 'wrong-secret' },
    );

    const response = await fetch(`${baseUrl}/slack/actions`, {
      body: request.body,
      headers: request.headers,
      method: 'POST',
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      replace_original: false,
      text: '❌ Invalid Slack signature',
    });
    expect(getPendingApproval('tx-slack-invalid-signature')).toMatchObject({
      status: 'PENDING',
      txId: 'tx-slack-invalid-signature',
    });
  });

  it('approves a pending transaction through /slack/actions', async () => {
    addPendingApproval({
      amountWei: '100000000000000',
      createdAt: '2026-03-20T08:00:00.000Z',
      network: '11155111',
      notified: true,
      reason: 'recipient not allowed',
      source: 'api',
      status: 'PENDING',
      to: '0x1111111111111111111111111111111111111111',
      txId: 'tx-slack-approve-1',
    });

    executeAgentPayTransferMock.mockReturnValue({
      mode: 'mock',
      raw: '{"ok":true}',
      success: true,
    });

    const request = createSignedSlackRequestBody({
      actions: [
        {
          action_id: 'approve_tx',
          value: 'tx-slack-approve-1',
        },
      ],
    });

    const response = await fetch(`${baseUrl}/slack/actions`, {
      body: request.body,
      headers: request.headers,
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      replace_original: true,
      text: expect.stringContaining('Approved and executed'),
    });
    expect(executeAgentPayTransferMock).toHaveBeenCalledWith(
      '0x1111111111111111111111111111111111111111',
      '100000000000000',
      '11155111',
    );
    expect(getPendingApproval('tx-slack-approve-1')).toBeUndefined();
    expect(getTransactionRecord('tx-slack-approve-1')).toMatchObject({
      approvedAt: expect.any(String),
      status: 'APPROVED',
      txId: 'tx-slack-approve-1',
    });
  });

  it('rejects a pending transaction through /slack/actions', async () => {
    addPendingApproval({
      amountWei: '100000000000000',
      createdAt: '2026-03-20T08:00:00.000Z',
      network: '11155111',
      notified: true,
      reason: 'recipient not allowed',
      source: 'api',
      status: 'PENDING',
      to: '0x1111111111111111111111111111111111111111',
      txId: 'tx-slack-reject-1',
    });

    const request = createSignedSlackRequestBody({
      actions: [
        {
          action_id: 'reject_tx',
          value: 'tx-slack-reject-1',
        },
      ],
    });

    const response = await fetch(`${baseUrl}/slack/actions`, {
      body: request.body,
      headers: request.headers,
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      replace_original: true,
      text: expect.stringContaining('Rejected'),
    });
    expect(executeAgentPayTransferMock).not.toHaveBeenCalled();
    expect(getPendingApproval('tx-slack-reject-1')).toBeUndefined();
    expect(getTransactionRecord('tx-slack-reject-1')).toMatchObject({
      rejectedAt: expect.any(String),
      status: 'REJECTED',
      txId: 'tx-slack-reject-1',
    });
  });
});
