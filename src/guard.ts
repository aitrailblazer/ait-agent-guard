export interface GuardPolicy {
  maxPerTxWei: bigint;
  allowedRecipients: string[];
}

function normalizeRecipient(recipient: string): string {
  return recipient.trim().toLowerCase();
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/u.test(value.trim());
}

export function validateTransaction(
  amountWei: bigint,
  recipient: string,
  policy: GuardPolicy,
): true {
  if (amountWei <= 0n) {
    throw new Error('DENIED: amount must be positive');
  }

  if (!isEvmAddress(recipient)) {
    throw new Error('DENIED: recipient must be a valid EVM address');
  }

  if (amountWei > policy.maxPerTxWei) {
    throw new Error('DENIED: amount exceeds limit');
  }

  const allowedRecipients = new Set(policy.allowedRecipients.map(normalizeRecipient));
  if (!allowedRecipients.has(normalizeRecipient(recipient))) {
    throw new Error('DENIED: recipient not allowed');
  }

  return true;
}
