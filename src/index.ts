import { executeAgentPayTransfer } from './agentpay.ts';
import {
  createPendingApprovalRequest,
  shouldRequestApproval,
} from './approval.ts';
import { type GuardDecision, type PolicyCheck } from './guard.ts';
import { type DecisionAction } from './logging.ts';
import {
  DEFAULT_NETWORK,
  evaluateAndLogTransactionRequest,
} from './transaction.ts';

interface CliOptions {
  amountArg?: string;
  dryRun: boolean;
  explain: boolean;
  recipient?: string;
}

function usage(): void {
  console.log('Usage: npm run start -- [--dry-run] [--explain] <recipient> <amount-wei>');
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
    const { amountWei, decision } = evaluateAndLogTransactionRequest(
      options.recipient,
      options.amountArg,
      resolveAction(options),
    );

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
      if (shouldRequestApproval(decision) && !options.dryRun) {
        const approval = await createPendingApprovalRequest({
          amountWei: amountWei.toString(),
          decision,
          network: DEFAULT_NETWORK,
          source: 'cli',
          to: options.recipient,
        });

        console.log('⏳ PENDING APPROVAL');
        console.log(`TxID: ${approval.txId}`);
        if (approval.notified) {
          console.log('Review in Slack or approve from the CLI.');
          console.log(`CLI fallback: npm run approve -- ${approval.txId}`);
        } else {
          console.log('Slack notification was not delivered.');
          if (approval.notificationError) {
            console.log(`Reason: ${approval.notificationError}`);
          }
        }
        return;
      }

      console.error(`❌ BLOCKED: ${decision.reason}`);
      process.exitCode = 1;
      return;
    }

    console.log('✅ ALLOWED by AgentGuard');

    if (options.dryRun) {
      console.log('🧪 DRY RUN: skipping AgentPay execution');
      return;
    }

    const result = executeAgentPayTransfer(
      options.recipient,
      amountWei.toString(),
      DEFAULT_NETWORK,
    );

    if (!result.success) {
      console.error('❌ AgentPay execution failed:');
      console.error(result.error);
      process.exitCode = 1;
      return;
    }

    console.log('🚀 Executed via AgentPay:');
    console.log(result.raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ERROR: ${message}`);
    process.exitCode = 1;
  }
}

void main();
