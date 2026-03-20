import { randomUUID } from 'node:crypto';

import { AGENTPAY_EXECUTION_MODE } from './agentpay.ts';
import type { GuardDecision } from './guard.ts';
import { logDecision } from './logging.ts';
import { sendApprovalRequest } from './slack.ts';
import { addPendingApproval, type PendingApproval } from './store.ts';

const APPROVAL_ELIGIBLE_REASONS = new Set([
  'amount exceeds limit',
  'recipient not allowed',
]);

interface PendingApprovalInput {
  amountWei: string;
  decision: GuardDecision;
  network: string;
  source: 'api' | 'cli';
  to: string;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function shouldRequestApproval(decision: GuardDecision): boolean {
  return (
    decision.status === 'BLOCKED' &&
    decision.reason !== undefined &&
    APPROVAL_ELIGIBLE_REASONS.has(decision.reason)
  );
}

export async function createPendingApprovalRequest(
  input: PendingApprovalInput,
): Promise<PendingApproval> {
  if (!shouldRequestApproval(input.decision) || !input.decision.reason) {
    throw new Error('pending approval requested for a decision that is not approval-eligible');
  }

  const createdAt = new Date().toISOString();
  const txId = randomUUID();
  let notificationError: string | undefined;
  let notified = false;

  try {
    notified = await sendApprovalRequest({
      amountWei: input.amountWei,
      createdAt,
      network: input.network,
      notified: false,
      reason: input.decision.reason,
      source: input.source,
      status: 'PENDING',
      to: input.to,
      txId,
    });
  } catch (error) {
    notificationError = formatError(error);
    console.warn(`⚠️ Failed to send Slack approval request: ${notificationError}`);
  }

  const approval: PendingApproval = {
    amountWei: input.amountWei,
    createdAt,
    network: input.network,
    notificationError,
    notified,
    reason: input.decision.reason,
    source: input.source,
    status: 'PENDING',
    to: input.to,
    txId,
  };

  addPendingApproval(approval);
  logDecision({
    action: input.source === 'cli' ? 'approval-request-cli' : 'approval-request-api',
    amountWei: input.amountWei,
    approvalTxId: txId,
    configuredExecutionMode: AGENTPAY_EXECUTION_MODE,
    decision: 'PENDING_APPROVAL',
    reason: input.decision.reason,
    recipient: input.to,
    timestamp: createdAt,
  });

  return approval;
}
