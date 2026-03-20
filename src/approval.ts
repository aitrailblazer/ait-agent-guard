import { randomUUID } from 'node:crypto';

import {
  AGENTPAY_EXECUTION_MODE,
  executeAgentPayTransfer,
  type AgentPayTransferResult,
} from './agentpay.ts';
import type { GuardDecision } from './guard.ts';
import { logDecision } from './logging.ts';
import { sendApprovalRequest } from './slack.ts';
import {
  addPendingApproval,
  getPendingApproval,
  removePendingApproval,
  upsertTransactionRecord,
  type PendingApproval,
} from './store.ts';

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

interface ApprovedPendingResult {
  approval: PendingApproval;
  mode: AgentPayTransferResult['mode'];
  raw: string;
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
  const approval: PendingApproval = {
    amountWei: input.amountWei,
    createdAt,
    network: input.network,
    notified: false,
    reason: input.decision.reason,
    source: input.source,
    status: 'PENDING',
    to: input.to,
    txId,
  };

  addPendingApproval(approval);
  upsertTransactionRecord(approval);

  try {
    approval.notified = await sendApprovalRequest(approval);
  } catch (error) {
    approval.notificationError = formatError(error);
    console.warn(`⚠️ Failed to send Slack approval request: ${approval.notificationError}`);
  }

  addPendingApproval(approval);
  upsertTransactionRecord(approval);
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

export function approvePendingApproval(
  txId: string,
  action: 'approve-cli' | 'approve-slack',
): ApprovedPendingResult {
  const approval = getPendingApproval(txId);

  if (!approval) {
    throw new Error('Transaction not found');
  }

  const result = executeAgentPayTransfer(
    approval.to,
    approval.amountWei,
    approval.network,
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  removePendingApproval(txId);
  const approvedAt = new Date().toISOString();
  upsertTransactionRecord({
    ...approval,
    approvedAt,
    status: 'APPROVED',
  });
  logDecision({
    action,
    amountWei: approval.amountWei,
    approvalTxId: approval.txId,
    configuredExecutionMode: result.mode,
    decision: 'APPROVED',
    reason: approval.reason,
    recipient: approval.to,
    timestamp: new Date().toISOString(),
  });

  return {
    approval,
    mode: result.mode,
    raw: result.raw,
  };
}

export function rejectPendingApproval(txId: string): PendingApproval {
  const approval = removePendingApproval(txId);

  if (!approval) {
    throw new Error('Transaction not found');
  }

  const rejectedAt = new Date().toISOString();
  upsertTransactionRecord({
    ...approval,
    rejectedAt,
    status: 'REJECTED',
  });
  logDecision({
    action: 'reject-slack',
    amountWei: approval.amountWei,
    approvalTxId: approval.txId,
    configuredExecutionMode: AGENTPAY_EXECUTION_MODE,
    decision: 'REJECTED',
    reason: approval.reason,
    recipient: approval.to,
    timestamp: new Date().toISOString(),
  });

  return approval;
}
