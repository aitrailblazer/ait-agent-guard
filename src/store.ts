import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

function readPendingApprovalsFile(): PendingApproval[] {
  const stateFilePath = getPendingStateFilePath();

  try {
    const raw = readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is PendingApproval =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as PendingApproval).txId === 'string',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ENOENT')) {
      return [];
    }

    throw new Error(`Failed to read pending approval store: ${message}`);
  }
}

function writePendingApprovalsFile(approvals: PendingApproval[]): void {
  const stateDirectoryPath = getPendingStateDirectoryPath();

  mkdirSync(stateDirectoryPath, { recursive: true });
  writeFileSync(
    getPendingStateFilePath(),
    `${JSON.stringify(approvals, null, 2)}\n`,
    'utf8',
  );
}

function getPendingStateDirectoryPath(): string {
  return join(process.cwd(), process.env.AGENTGUARD_STATE_DIR ?? '.agentguard-state');
}

function getPendingStateFilePath(): string {
  return join(getPendingStateDirectoryPath(), 'pending-approvals.json');
}

export function addPendingApproval(approval: PendingApproval): void {
  const approvals = readPendingApprovalsFile().filter(
    (existingApproval) => existingApproval.txId !== approval.txId,
  );

  approvals.push(approval);
  writePendingApprovalsFile(approvals);
}

export function getPendingApproval(txId: string): PendingApproval | undefined {
  return readPendingApprovalsFile().find((approval) => approval.txId === txId);
}

export function removePendingApproval(txId: string): PendingApproval | undefined {
  const approvals = readPendingApprovalsFile();
  const approval = approvals.find((existingApproval) => existingApproval.txId === txId);

  if (!approval) {
    return undefined;
  }

  writePendingApprovalsFile(
    approvals.filter((existingApproval) => existingApproval.txId !== txId),
  );

  return approval;
}

export function clearPendingApprovals(): void {
  rmSync(getPendingStateDirectoryPath(), { force: true, recursive: true });
}
