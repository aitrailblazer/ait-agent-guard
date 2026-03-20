import { execSync } from 'node:child_process';

export const AGENTPAY_EXECUTION_MODE = 'real' as const;

export type AgentPayTransferResult =
  | {
      raw: string;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

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
      raw: output.trim(),
      success: true,
    };
  } catch (error) {
    return {
      error: readExecutionError(error),
      success: false,
    };
  }
}
