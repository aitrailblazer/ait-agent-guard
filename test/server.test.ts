import { rmSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/server.ts';
import {
  clearPendingApprovals,
  getPendingApproval,
  getTransactionRecord,
} from '../src/store.ts';

describe('AgentGuard HTTP API', () => {
  let baseUrl = '';
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;
  let stateDir: string;

  beforeEach(async () => {
    stateDir = join(
      tmpdir(),
      `agentguard-server-test-${Math.random().toString(16).slice(2)}`,
    );
    process.env.AGENTGUARD_STATE_DIR = stateDir;
    process.env.SLACK_WEBHOOK_URL = '';
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
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

  it('blocks a disallowed recipient on /validate', async () => {
    const response = await fetch(`${baseUrl}/validate`, {
      body: JSON.stringify({
        amountWei: '100000000000000',
        to: '0x9999999999999999999999999999999999999999',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'recipient not allowed',
      status: 'BLOCKED',
    });
  });

  it('executes through the fallback path on /validate-and-execute', async () => {
    const response = await fetch(`${baseUrl}/validate-and-execute`, {
      body: JSON.stringify({
        amountWei: '100000000000000',
        to: '0x1111111111111111111111111111111111111111',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: 'mock',
      status: 'EXECUTED',
    });
  });

  it('creates a pending approval on /execute when the block is approval-eligible', async () => {
    const response = await fetch(`${baseUrl}/execute`, {
      body: JSON.stringify({
        amountWei: '100000000000000',
        to: '0x9999999999999999999999999999999999999999',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(202);
    const body = (await response.json()) as {
      notified: boolean;
      reason: string;
      status: string;
      txId: string;
    };

    expect(body).toMatchObject({
      notified: false,
      reason: 'recipient not allowed',
      status: 'PENDING_APPROVAL',
    });
    expect(body.txId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    expect(getPendingApproval(body.txId)).toMatchObject({
      amountWei: '100000000000000',
      reason: 'recipient not allowed',
      source: 'api',
      status: 'PENDING',
      to: '0x9999999999999999999999999999999999999999',
      txId: body.txId,
    });
    expect(getTransactionRecord(body.txId)).toMatchObject({
      amountWei: '100000000000000',
      reason: 'recipient not allowed',
      source: 'api',
      status: 'PENDING',
      to: '0x9999999999999999999999999999999999999999',
      txId: body.txId,
    });
  });

  it('lists persisted transactions on /transactions', async () => {
    const pendingResponse = await fetch(`${baseUrl}/execute`, {
      body: JSON.stringify({
        amountWei: '100000000000000',
        to: '0x9999999999999999999999999999999999999999',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    expect(pendingResponse.status).toBe(202);
    const pendingBody = (await pendingResponse.json()) as { txId: string };

    const response = await fetch(`${baseUrl}/transactions`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toContainEqual(
      expect.objectContaining({
        status: 'PENDING',
        txId: pendingBody.txId,
      }),
    );
  });
});
