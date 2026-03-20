import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from 'express';
import { pathToFileURL } from 'node:url';

import { executeAgentPayTransfer } from './agentpay.ts';
import {
  createPendingApprovalRequest,
  shouldRequestApproval,
} from './approval.ts';
import { type GuardDecision } from './guard.ts';
import {
  DEFAULT_NETWORK,
  evaluateAndLogTransactionRequest,
} from './transaction.ts';

const DEFAULT_PORT = 3000;

interface ExecuteRequestBody {
  amountWei?: string | number;
  network?: string | number;
  to?: string;
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
