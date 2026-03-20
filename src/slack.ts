import { loadRuntimeEnv } from './env.ts';
import type { PendingApproval } from './store.ts';

interface SlackMessagePayload {
  blocks?: Array<Record<string, unknown>>;
  text: string;
}

function readSlackWebhookUrl(): string | undefined {
  loadRuntimeEnv();

  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhook) {
    console.warn('⚠️ No Slack webhook configured');
    return undefined;
  }

  return webhook;
}

export async function sendSlackMessage(payload: SlackMessagePayload): Promise<boolean> {
  const webhook = readSlackWebhookUrl();
  if (!webhook) {
    return false;
  }

  const response = await fetch(webhook, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status} ${response.statusText}`);
  }

  return true;
}

export async function sendApprovalRequest(approval: PendingApproval): Promise<boolean> {
  return sendSlackMessage({
    blocks: [
      {
        text: {
          text: [
            '🚨 *AgentGuard Approval Required*',
            '',
            `*TxID:* ${approval.txId}`,
            `*To:* ${approval.to}`,
            `*Amount:* ${approval.amountWei}`,
            `*Network:* ${approval.network}`,
            `*Reason:* ${approval.reason}`,
            `*Status:* ${approval.status}`,
          ].join('\n'),
          type: 'mrkdwn',
        },
        type: 'section',
      },
    ],
    text: `AgentGuard approval required for ${approval.txId}`,
  });
}
