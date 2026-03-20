export interface PendingApproval {
  amountWei: string;
  createdAt: string;
  network: string;
  notificationError?: string;
  notified: boolean;
  reason: string;
  source: 'api' | 'cli';
  status: 'PENDING';
  to: string;
  txId: string;
}

const pendingApprovals = new Map<string, PendingApproval>();

export function addPendingApproval(approval: PendingApproval): void {
  pendingApprovals.set(approval.txId, approval);
}

export function getPendingApproval(txId: string): PendingApproval | undefined {
  return pendingApprovals.get(txId);
}

export function clearPendingApprovals(): void {
  pendingApprovals.clear();
}
