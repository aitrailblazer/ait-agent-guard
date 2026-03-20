import { readFileSync } from 'node:fs';

export interface GuardPolicy {
  maxPerTxWei: bigint;
  allowedRecipients: string[];
}

export interface PolicyCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface GuardDecision {
  status: 'ALLOWED' | 'BLOCKED';
  reason?: string;
  checks: PolicyCheck[];
}

interface PolicyFileShape {
  maxPerTxWei?: unknown;
  allowedRecipients?: unknown;
}

const POLICY_FILE_URL = new URL('../policy.json', import.meta.url);

function normalizeRecipient(recipient: string): string {
  return recipient.trim().toLowerCase();
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/u.test(value.trim());
}

function blockDecision(
  checks: PolicyCheck[],
  label: string,
  detail: string,
  reason: string,
): GuardDecision {
  return {
    status: 'BLOCKED',
    reason,
    checks: [...checks, { label, ok: false, detail }],
  };
}

export function loadPolicy(): GuardPolicy {
  let rawPolicy: string;

  try {
    rawPolicy = readFileSync(POLICY_FILE_URL, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read policy.json: ${message}`);
  }

  let parsed: PolicyFileShape;

  try {
    parsed = JSON.parse(rawPolicy) as PolicyFileShape;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse policy.json: ${message}`);
  }

  if (typeof parsed.maxPerTxWei !== 'string' || parsed.maxPerTxWei.trim() === '') {
    throw new Error('policy.json maxPerTxWei must be a non-empty integer string');
  }

  let maxPerTxWei: bigint;
  try {
    maxPerTxWei = BigInt(parsed.maxPerTxWei);
  } catch {
    throw new Error('policy.json maxPerTxWei must be a valid integer string');
  }

  if (!Array.isArray(parsed.allowedRecipients)) {
    throw new Error('policy.json allowedRecipients must be an array of recipient strings');
  }

  if (parsed.allowedRecipients.some((value) => typeof value !== 'string')) {
    throw new Error('policy.json allowedRecipients must only contain strings');
  }

  return {
    maxPerTxWei,
    allowedRecipients: parsed.allowedRecipients,
  };
}

export function evaluateTransaction(
  amountWei: bigint,
  recipient: string,
  policy: GuardPolicy,
): GuardDecision {
  const checks: PolicyCheck[] = [];

  if (amountWei <= 0n) {
    return blockDecision(
      checks,
      'Amount is positive',
      `${amountWei} wei is not greater than zero`,
      'amount must be positive',
    );
  }

  checks.push({
    label: 'Amount is positive',
    ok: true,
    detail: `${amountWei} wei is greater than zero`,
  });

  if (!isEvmAddress(recipient)) {
    return blockDecision(
      checks,
      'Recipient is a valid EVM address',
      `${recipient} is not a valid 20-byte hex address`,
      'recipient must be a valid EVM address',
    );
  }

  checks.push({
    label: 'Recipient is a valid EVM address',
    ok: true,
    detail: `${recipient} matches the expected EVM address format`,
  });

  if (amountWei > policy.maxPerTxWei) {
    return blockDecision(
      checks,
      'Amount is within maxPerTxWei',
      `${amountWei} wei exceeds the policy limit of ${policy.maxPerTxWei} wei`,
      'amount exceeds limit',
    );
  }

  checks.push({
    label: 'Amount is within maxPerTxWei',
    ok: true,
    detail: `${amountWei} wei is within the policy limit of ${policy.maxPerTxWei} wei`,
  });

  const normalizedRecipient = normalizeRecipient(recipient);
  const allowedRecipients = new Set(policy.allowedRecipients.map(normalizeRecipient));

  if (!allowedRecipients.has(normalizedRecipient)) {
    return blockDecision(
      checks,
      'Recipient is allowlisted',
      `${recipient} is not present in policy.allowedRecipients`,
      'recipient not allowed',
    );
  }

  checks.push({
    label: 'Recipient is allowlisted',
    ok: true,
    detail: `${recipient} matches an entry in policy.allowedRecipients`,
  });

  return {
    status: 'ALLOWED',
    checks,
  };
}
