import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execSyncMock } = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
}));

import { executeAgentPayTransfer } from '../src/agentpay.ts';

describe('AgentPay execution fallback', () => {
  beforeEach(() => {
    execSyncMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to mock mode when AgentPay is not installed', () => {
    execSyncMock.mockImplementationOnce(() => {
      throw new Error('agentpay missing');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = executeAgentPayTransfer(
      '0x1111111111111111111111111111111111111111',
      '100000000000000',
      '11155111',
    );

    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ AgentPay not found — falling back to MOCK mode',
    );
    expect(result).toMatchObject({
      mode: 'mock',
      success: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected fallback to return a mock success result');
    }
    expect(JSON.parse(result.raw)).toMatchObject({
      amountWei: '100000000000000',
      mode: 'mock',
      network: '11155111',
      to: '0x1111111111111111111111111111111111111111',
    });
  });

  it('executes the real AgentPay CLI when the binary is available', () => {
    execSyncMock.mockImplementationOnce(() => '');
    execSyncMock.mockImplementationOnce(() => 'tx-hash-0x123\n');

    const result = executeAgentPayTransfer(
      '0x1111111111111111111111111111111111111111',
      '100000000000000',
      '11155111',
    );

    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'which agentpay', {
      stdio: 'ignore',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("'agentpay' 'transfer-native' '--network' '11155111'"),
      expect.objectContaining({
        encoding: 'utf8',
      }),
    );
    expect(result).toMatchObject({
      mode: 'real',
      raw: 'tx-hash-0x123',
      success: true,
    });
  });

  it('returns a structured failure when the real CLI exits with stderr', () => {
    execSyncMock.mockImplementationOnce(() => '');
    execSyncMock.mockImplementationOnce(() => {
      const error = new Error('transfer failed') as Error & { stderr: string };
      error.stderr = 'policy rejected by agentpay';
      throw error;
    });

    const result = executeAgentPayTransfer(
      '0x1111111111111111111111111111111111111111',
      '100000000000000',
      '11155111',
    );

    expect(result).toMatchObject({
      error: 'policy rejected by agentpay',
      mode: 'real',
      success: false,
    });
  });
});
