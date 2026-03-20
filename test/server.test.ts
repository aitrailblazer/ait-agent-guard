import { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/server.ts';
import {
  clearPendingApprovals,
  getPendingApproval,
} from '../src/store.ts';

describe('AgentGuard HTTP API', () => {
  let baseUrl = '';
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;

  beforeEach(async () => {
    process.env.SLACK_WEBHOOK_URL = '';
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
  });
});
