import { execa } from 'execa';

export const AGENTPAY_EXECUTION_MODE =
  process.env.AGENTGUARD_USE_MOCK === 'false' ? 'real' : 'mock';

export async function sendWithAgentPay(
  to: string,
  amountWei: string,
  network: string,
): Promise<string> {
  if (AGENTPAY_EXECUTION_MODE === 'mock') {
    console.log('[AgentPay MOCK]');
    console.log({
      to,
      amount: amountWei,
      network,
    });

    return 'mock-tx-hash-0x123';
  }

  try {
    const { stdout } = await execa('agentpay', [
      'transfer-native',
      '--network',
      network,
      '--to',
      to,
      '--amount-wei',
      amountWei,
    ]);

    return stdout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      throw new Error(
        'AgentPay is not installed locally. Install it and rerun with AGENTGUARD_USE_MOCK=false.',
      );
    }

    throw error;
  }
}
