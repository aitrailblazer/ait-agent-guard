import { appendFileSync, mkdirSync } from 'node:fs';

import type { GuardDecision } from './guard.ts';

export type DecisionAction =
  | 'execute'
  | 'dry-run'
  | 'explain'
  | 'api-validate'
  | 'api-execute'
  | 'approval-request-api'
  | 'approval-request-cli'
  | 'approve-cli'
  | 'approve-slack'
  | 'reject-slack';

export interface DecisionLogEntry {
  action: DecisionAction;
  amountWei: string;
  approvalTxId?: string;
  configuredExecutionMode: 'auto' | 'mock' | 'real';
  decision: GuardDecision['status'] | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  reason?: string;
  recipient: string;
  timestamp: string;
}

const LOGS_DIRECTORY_URL = new URL('../logs/', import.meta.url);
const DECISION_LOG_URL = new URL('../logs/decisions.log', import.meta.url);

export function logDecision(entry: DecisionLogEntry): void {
  mkdirSync(LOGS_DIRECTORY_URL, { recursive: true });
  appendFileSync(DECISION_LOG_URL, `${JSON.stringify(entry)}\n`, 'utf8');
}
