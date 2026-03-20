import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from 'express';
import type { IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';

import { executeAgentPayTransfer } from './agentpay.ts';
import {
  approvePendingApproval,
  createPendingApprovalRequest,
  rejectPendingApproval,
  shouldRequestApproval,
} from './approval.ts';
import { type GuardDecision } from './guard.ts';
import { listTransactionRecords } from './store.ts';
import {
  DEFAULT_NETWORK,
  evaluateAndLogTransactionRequest,
} from './transaction.ts';
import { verifySlackSignature } from './verifySlack.ts';

const DEFAULT_PORT = 3000;

interface ExecuteRequestBody {
  amountWei?: string | number;
  network?: string | number;
  to?: string;
}

interface SlackAction {
  action_id?: string;
  value?: string;
}

interface SlackActionPayload {
  actions?: SlackAction[];
}

interface RawBodyRequest extends Request {
  rawBody?: string;
}

function captureRawBody(
  req: IncomingMessage,
  _res: Response,
  buffer: Buffer,
): void {
  (req as RawBodyRequest).rawBody = buffer.toString('utf8');
}

function missingFieldsResponse(res: Response): Response {
  return res.status(400).json({
    error: 'Missing required fields: to, amountWei',
  });
}

function sendDecisionResponse(res: Response, decision: GuardDecision): Response {
  if (decision.status === 'BLOCKED') {
    return res.status(403).json({
      checks: decision.checks,
      reason: decision.reason,
      status: decision.status,
    });
  }

  return res.json({
    checks: decision.checks,
    status: decision.status,
  });
}

function coerceBodyValue(value: string | number | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function readExecuteRequestBody(req: Request): ExecuteRequestBody {
  if (typeof req.body !== 'object' || req.body === null) {
    return {};
  }

  return req.body as ExecuteRequestBody;
}

function readSlackActionPayload(req: Request): SlackActionPayload {
  if (typeof req.body !== 'object' || req.body === null) {
    throw new Error('Missing Slack payload');
  }

  const { payload } = req.body as { payload?: unknown };
  if (typeof payload !== 'string' || payload.trim() === '') {
    throw new Error('Missing Slack payload');
  }

  try {
    return JSON.parse(payload) as SlackActionPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Slack payload: ${message}`);
  }
}

function sendSlackActionResponse(
  res: Response,
  text: string,
  replaceOriginal = true,
): void {
  res.json({
    replace_original: replaceOriginal,
    text,
  });
}

function handleValidation(
  req: Request,
  res: Response,
  action: 'api-validate' | 'api-execute',
): {
  amountWei: bigint;
  decision: GuardDecision;
  network: string;
  to: string;
} | Response {
  const body = readExecuteRequestBody(req);
  const to = coerceBodyValue(body.to);
  const amountWeiArg = coerceBodyValue(body.amountWei);
  const network = coerceBodyValue(body.network) ?? DEFAULT_NETWORK;

  if (!to || !amountWeiArg) {
    return missingFieldsResponse(res);
  }

  try {
    const { amountWei, decision } = evaluateAndLogTransactionRequest(
      to,
      amountWeiArg,
      action,
    );

    return {
      amountWei,
      decision,
      network,
      to,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(400).json({
      error: message,
    });
  }
}

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.get('/transactions', (_req, res) => {
    res.json(listTransactionRecords());
  });

  app.post('/validate', (req, res) => {
    const validationResult = handleValidation(req, res, 'api-validate');

    if ('statusCode' in validationResult) {
      return;
    }

    sendDecisionResponse(res, validationResult.decision);
  });

  const executeHandler = async (req: Request, res: Response): Promise<void> => {
    const validationResult = handleValidation(req, res, 'api-execute');

    if ('statusCode' in validationResult) {
      return;
    }

    if (validationResult.decision.status === 'BLOCKED') {
      if (shouldRequestApproval(validationResult.decision)) {
        const approval = await createPendingApprovalRequest({
          amountWei: validationResult.amountWei.toString(),
          decision: validationResult.decision,
          network: validationResult.network,
          source: 'api',
          to: validationResult.to,
        });

        res.status(202).json({
          notified: approval.notified,
          notificationError: approval.notificationError,
          reason: approval.reason,
          status: 'PENDING_APPROVAL',
          txId: approval.txId,
        });
        return;
      }

      sendDecisionResponse(res, validationResult.decision);
      return;
    }

    const result = executeAgentPayTransfer(
      validationResult.to,
      validationResult.amountWei.toString(),
      validationResult.network,
    );

    if (!result.success) {
      res.status(500).json({
        error: result.error,
        mode: result.mode,
        status: 'ERROR',
      });
      return;
    }

    res.json({
      mode: result.mode,
      result: result.raw,
      status: 'EXECUTED',
    });
  };

  app.post('/execute', executeHandler);
  app.post('/validate-and-execute', executeHandler);
  app.post(
    '/slack/actions',
    express.urlencoded({ extended: false, verify: captureRawBody }),
    (req, res) => {
      try {
        const isValidSignature = verifySlackSignature({
          rawBody: (req as RawBodyRequest).rawBody,
          signatureHeader: req.headers['x-slack-signature'],
          timestampHeader: req.headers['x-slack-request-timestamp'],
        });

        if (!isValidSignature) {
          res.status(401).json({
            replace_original: false,
            text: '❌ Invalid Slack signature',
          });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({
          replace_original: false,
          text: `❌ ${message}`,
        });
        return;
      }

    let payload: SlackActionPayload;

    try {
      payload = readSlackActionPayload(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({
        text: `❌ ${message}`,
      });
      return;
    }

    const action = payload.actions?.[0];
    if (!action?.action_id || !action.value) {
      res.status(400).json({
        text: '❌ Missing Slack action payload',
      });
      return;
    }

    try {
      if (action.action_id === 'approve_tx') {
        const result = approvePendingApproval(action.value, 'approve-slack');
        sendSlackActionResponse(
          res,
          [
            '✅ Approved and executed',
            `TxID: ${result.approval.txId}`,
            `To: ${result.approval.to}`,
            `Amount: ${result.approval.amountWei}`,
            `Mode: ${result.mode}`,
          ].join('\n'),
        );
        return;
      }

      if (action.action_id === 'reject_tx') {
        const approval = rejectPendingApproval(action.value);
        sendSlackActionResponse(
          res,
          [
            '❌ Rejected',
            `TxID: ${approval.txId}`,
            `To: ${approval.to}`,
            `Amount: ${approval.amountWei}`,
          ].join('\n'),
        );
        return;
      }

      res.status(400).json({
        text: `❌ Unknown Slack action: ${action.action_id}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendSlackActionResponse(res, `❌ ${message}`, false);
    }
    },
  );

  const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: 'Invalid JSON body',
      });
      return;
    }

    next(error);
  };

  app.use(jsonErrorHandler);

  return app;
}

export function startServer(port = Number(process.env.PORT ?? DEFAULT_PORT)) {
  const app = createApp();

  return app.listen(port, () => {
    console.log(`🚀 AgentGuard API running on http://localhost:${port}`);
  });
}

const entrypointUrl = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (entrypointUrl === import.meta.url) {
  startServer();
}
