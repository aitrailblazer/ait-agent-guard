import { AGENTPAY_EXECUTION_MODE } from './agentpay.ts';
import { evaluateTransaction, loadPolicy, type GuardDecision } from './guard.ts';
import { logDecision, type DecisionAction } from './logging.ts';

export const DEFAULT_NETWORK = '11155111';

export interface EvaluatedTransactionRequest {
  amountWei: bigint;
  decision: GuardDecision;
}

export function parseAmountWei(amountArg: string): bigint {
  try {
    return BigInt(amountArg);
  } catch {
    throw new Error('amount must be an integer wei value');
  }
}

export function evaluateAndLogTransactionRequest(
  recipient: string,
  amountArg: string,
  action: DecisionAction,
): EvaluatedTransactionRequest {
  const amountWei = parseAmountWei(amountArg);
  const policy = loadPolicy();
  const decision = evaluateTransaction(amountWei, recipient, policy);

  logDecision({
    action,
    amountWei: amountWei.toString(),
    configuredExecutionMode: AGENTPAY_EXECUTION_MODE,
    decision: decision.status,
    reason: decision.reason,
    recipient,
    timestamp: new Date().toISOString(),
  });

  return {
    amountWei,
    decision,
  };
}
