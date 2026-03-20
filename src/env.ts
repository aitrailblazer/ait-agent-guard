let didLoadRuntimeEnv = false;

export function loadRuntimeEnv(): void {
  if (didLoadRuntimeEnv || process.env.VITEST) {
    return;
  }

  didLoadRuntimeEnv = true;

  if (
    process.env.SLACK_WEBHOOK_URL !== undefined &&
    process.env.SLACK_SIGNING_SECRET !== undefined
  ) {
    return;
  }

  try {
    process.loadEnvFile?.('.env');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ENOENT')) {
      return;
    }

    console.warn(`⚠️ Failed to load .env: ${message}`);
  }
}
