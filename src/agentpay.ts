import { execSync } from 'node:child_process';

export const AGENTPAY_EXECUTION_MODE = 'auto' as const;

export type AgentPayTransferResult =
  | {
      mode: 'mock' | 'real';
      raw: string;
      success: true;
    }
  | {
      error: string;
      mode: 'real';
      success: false;
    };

function isAgentPayInstalled(): boolean {
  try {
    execSync('which agentpay', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function readExecutionError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim();
    }

    if (Buffer.isBuffer(stderr)) {
      const message = stderr.toString('utf8').trim();
      if (message !== '') {
        return message;
      }
    }
  }

  return error instanceof Error ? error.message : 'AgentPay execution failed';
}

export function executeAgentPayTransfer(
  to: string,
  amountWei: string,
  network: string,
): AgentPayTransferResult {
  if (!isAgentPayInstalled()) {
    console.warn('⚠️ AgentPay not found — falling back to MOCK mode');

    return {
      mode: 'mock',
      raw: JSON.stringify(
        {
          amountWei,
          mode: 'mock',
          network,
          to,
        },
        null,
        2,
      ),
      success: true,
    };
  }

  const commandParts = [
    'agentpay',
    'transfer-native',
    '--network',
    network,
    '--to',
    to,
    '--amount-wei',
    amountWei,
  ];
  const command = commandParts.map(shellEscape).join(' ');

  try {
    console.log(`⚡ Running: ${command}`);

    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return {
      mode: 'real',
      raw: output.trim(),
      success: true,
    };
  } catch (error) {
    return {
      error: readExecutionError(error),
      mode: 'real',
      success: false,
    };
  }
}
