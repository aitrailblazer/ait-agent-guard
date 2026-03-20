import { approvePendingApproval } from './approval.ts';

export function approvePendingTransaction(txId: string): {
  mode: 'mock' | 'real';
  raw: string;
} {
  const result = approvePendingApproval(txId, 'approve-cli');

  return {
    mode: result.mode,
    raw: result.raw,
  };
}

function usage(): void {
  console.log('Usage: npm run approve -- <tx-id>');
}

async function main(): Promise<void> {
  const txId = process.argv[2];

  if (!txId) {
    usage();
    console.error('❌ Missing txId');
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`✅ APPROVED: ${txId}`);
    const result = approvePendingTransaction(txId);
    console.log('🚀 Executed via AgentPay:');
    console.log(result.raw);
    console.log(`Mode: ${result.mode}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  }
}

void main();
