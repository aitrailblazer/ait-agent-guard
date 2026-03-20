import { AGENTPAY_EXECUTION_MODE, sendWithAgentPay } from './agentpay.ts';
import {
  evaluateTransaction,
  loadPolicy,
  type GuardDecision,
  type PolicyCheck,
} from './guard.ts';
import { logDecision, type DecisionAction } from './logging.ts';

const DEFAULT_NETWORK = '11155111';

interface CliOptions {
  amountArg?: string;
  dryRun: boolean;
  explain: boolean;
  recipient?: string;
}

function usage(): void {
  console.log('Usage: npm run start -- [--dry-run] [--explain] <recipient> <amount-wei>');
}

function parseAmountWei(amountArg: string): bigint {
  try {
    return BigInt(amountArg);
  } catch {
    throw new Error('amount must be an integer wei value');
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    explain: false,
  };
  const positionalArgs: string[] = [];

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--explain') {
      options.explain = true;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`unknown flag: ${arg}`);
    }

    positionalArgs.push(arg);
  }

  if (positionalArgs.length > 2) {
    throw new Error('expected exactly two positional arguments: <recipient> <amount-wei>');
  }

  [options.recipient, options.amountArg] = positionalArgs;
  return options;
}

function printCheck(check: PolicyCheck): void {
  const marker = check.ok ? '✔' : '✖';
  console.log(`${marker} ${check.label}: ${check.detail}`);
}

function printEvaluation(decision: GuardDecision): void {
  console.log('Policy evaluation:');
  for (const check of decision.checks) {
    printCheck(check);
  }
  console.log(`Decision: ${decision.status}`);
  if (decision.reason) {
    console.log(`Reason: ${decision.reason}`);
  }
}

function resolveAction(options: CliOptions): DecisionAction {
  if (options.explain) {
    return 'explain';
  }

  if (options.dryRun) {
    return 'dry-run';
  }

  return 'execute';
}

async function main(): Promise<void> {
  let options: CliOptions;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    usage();
    console.error(`❌ ERROR: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (!options.recipient || !options.amountArg) {
    usage();
    process.exitCode = 1;
    return;
  }

  try {
    const amountWei = parseAmountWei(options.amountArg);
    const policy = loadPolicy();
    const decision = evaluateTransaction(amountWei, options.recipient, policy);

    logDecision({
      action: resolveAction(options),
      amountWei: amountWei.toString(),
      configuredExecutionMode: AGENTPAY_EXECUTION_MODE,
      decision: decision.status,
      reason: decision.reason,
      recipient: options.recipient,
      timestamp: new Date().toISOString(),
    });

    if (options.explain) {
      printEvaluation(decision);
      if (decision.status === 'BLOCKED') {
        process.exitCode = 1;
      } else {
        console.log('Execution skipped because --explain was provided.');
      }
      return;
    }

    if (decision.status === 'BLOCKED') {
      console.error(`❌ BLOCKED: ${decision.reason}`);
      process.exitCode = 1;
      return;
    }

    console.log('✅ ALLOWED by AgentGuard');

    if (options.dryRun) {
      console.log('🧪 Dry run: execution skipped.');
      return;
    }

    const result = await sendWithAgentPay(
      options.recipient,
      amountWei.toString(),
      DEFAULT_NETWORK,
    );

    console.log('🚀 Executed via AgentPay:');
    console.log(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ERROR: ${message}`);
    process.exitCode = 1;
  }
}

void main();
