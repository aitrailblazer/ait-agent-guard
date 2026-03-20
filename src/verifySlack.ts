import { createHmac, timingSafeEqual } from 'node:crypto';

import { loadRuntimeEnv } from './env.ts';

const SLACK_REQUEST_MAX_AGE_SECONDS = 5 * 60;

export interface SlackSignatureInput {
  rawBody?: string;
  signatureHeader?: string | string[];
  timestampHeader?: string | string[];
}

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

function readSlackSigningSecret(): string {
  loadRuntimeEnv();

  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!signingSecret) {
    throw new Error('SLACK_SIGNING_SECRET is not configured');
  }

  return signingSecret;
}

export function verifySlackSignature(input: SlackSignatureInput): boolean {
  const signingSecret = readSlackSigningSecret();
  const rawBody = input.rawBody;
  const timestampHeader = normalizeHeaderValue(input.timestampHeader);
  const signatureHeader = normalizeHeaderValue(input.signatureHeader)?.trim();

  if (!rawBody || !timestampHeader || !signatureHeader) {
    return false;
  }

  const requestTimestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(requestTimestamp)) {
    return false;
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - requestTimestamp) > SLACK_REQUEST_MAX_AGE_SECONDS) {
    return false;
  }

  const signatureBaseString = `v0:${timestampHeader}:${rawBody}`;
  const computedSignature = `v0=${createHmac('sha256', signingSecret)
    .update(signatureBaseString, 'utf8')
    .digest('hex')}`;
  const providedSignatureBuffer = Buffer.from(signatureHeader, 'utf8');
  const computedSignatureBuffer = Buffer.from(computedSignature, 'utf8');

  if (providedSignatureBuffer.length !== computedSignatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedSignatureBuffer, computedSignatureBuffer);
}
