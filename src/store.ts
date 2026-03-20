import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface ApprovalRecordBase {
  amountWei: string;
  createdAt: string;
  network: string;
  notificationError?: string;
  notified: boolean;
  reason: string;
  source: 'api' | 'cli';
  to: string;
  txId: string;
}

export interface PendingApproval {
  amountWei: ApprovalRecordBase['amountWei'];
  createdAt: ApprovalRecordBase['createdAt'];
  network: ApprovalRecordBase['network'];
  notificationError?: ApprovalRecordBase['notificationError'];
  notified: ApprovalRecordBase['notified'];
  reason: ApprovalRecordBase['reason'];
  source: ApprovalRecordBase['source'];
  status: 'PENDING';
  to: ApprovalRecordBase['to'];
  txId: ApprovalRecordBase['txId'];
}

export interface TransactionRecord extends ApprovalRecordBase {
  approvedAt?: string;
  rejectedAt?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

function readStateFile<T extends { txId: string }>(stateFilePath: string): T[] {
  try {
    const raw = readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is T =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as T).txId === 'string',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ENOENT')) {
      return [];
    }

    throw new Error(`Failed to read state file ${stateFilePath}: ${message}`);
  }
}

function readPendingApprovalsFile(): PendingApproval[] {
  return readStateFile<PendingApproval>(getPendingStateFilePath());
}

function readTransactionsFile(): TransactionRecord[] {
  return readStateFile<TransactionRecord>(getTransactionsStateFilePath());
}

function writeStateFile(stateFilePath: string, state: Array<{ txId: string }>): void {
  const stateDirectoryPath = getPendingStateDirectoryPath();

  mkdirSync(stateDirectoryPath, { recursive: true });
  writeFileSync(
    stateFilePath,
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}

function writePendingApprovalsFile(approvals: PendingApproval[]): void {
  writeStateFile(getPendingStateFilePath(), approvals);
}

function writeTransactionsFile(transactions: TransactionRecord[]): void {
  writeStateFile(getTransactionsStateFilePath(), transactions);
}

function getPendingStateDirectoryPath(): string {
  return join(process.cwd(), process.env.AGENTGUARD_STATE_DIR ?? '.agentguard-state');
}

function getPendingStateFilePath(): string {
  return join(getPendingStateDirectoryPath(), 'pending-approvals.json');
}

function getTransactionsStateFilePath(): string {
  return join(getPendingStateDirectoryPath(), 'transactions.json');
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

export function upsertTransactionRecord(record: TransactionRecord): void {
  const transactions = readTransactionsFile().filter(
    (existingRecord) => existingRecord.txId !== record.txId,
  );

  transactions.push(record);
  writeTransactionsFile(transactions);
}

export function getTransactionRecord(txId: string): TransactionRecord | undefined {
  return readTransactionsFile().find((record) => record.txId === txId);
}

export function listTransactionRecords(): TransactionRecord[] {
  return readTransactionsFile().sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
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
