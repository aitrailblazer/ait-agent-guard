import { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/server.ts';

describe('AgentGuard HTTP API', () => {
  let baseUrl = '';
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;

  beforeEach(async () => {
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
});
