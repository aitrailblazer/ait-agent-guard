import { sendWithAgentPay } from './agentpay.ts';
import { type GuardPolicy, validateTransaction } from './guard.ts';

const DEFAULT_NETWORK = '11155111';

const policy: GuardPolicy = {
  maxPerTxWei: 1_000_000_000_000_000n,
  allowedRecipients: ['0x1111111111111111111111111111111111111111'],
};

function usage(): void {
  console.log('Usage: npm run start -- <recipient> <amount-wei>');
}

function parseAmountWei(amountArg: string): bigint {
  try {
    return BigInt(amountArg);
  } catch {
    throw new Error('DENIED: amount must be an integer wei value');
  }
}

async function main(): Promise<void> {
  const [to, amountArg] = process.argv.slice(2);

  if (!to || !amountArg) {
    usage();
    process.exitCode = 1;
    return;
  }

  try {
    const amountWei = parseAmountWei(amountArg);

    validateTransaction(amountWei, to, policy);
    console.log('✅ ALLOWED by AgentGuard');

    const result = await sendWithAgentPay(to, amountWei.toString(), DEFAULT_NETWORK);

    console.log('🚀 Executed via AgentPay:');
    console.log(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ BLOCKED: ${message}`);
    process.exitCode = 1;
  }
}

void main();
