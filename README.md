# AgentGuard
Version: v0.1.0

Control layer for AgentPay that prevents unsafe AI-driven spending of USD1.

> Stop AI agents from making unsafe financial transactions.

AgentGuard prevents unsafe or unintended AI-driven transactions before they reach execution.

## Overview

AgentPay provides secure, self-custodial transaction execution with policy enforcement.

AgentGuard extends that foundation with a higher-level control layer for real-world usage:

- Validate transactions before execution
- Enforce system-level spending rules
- Enable safer AI-driven financial operations
- Add visibility and coordination across agents

## What Is AgentPay?

AgentPay is a local, self-custodial runtime for executing blockchain transactions with built-in policy enforcement.

It is developed by World Liberty Financial (WLFI) and released as an open-source SDK.

Official site: [agentpay.worldlibertyfinancial.com](https://agentpay.worldlibertyfinancial.com/)

At a high level, AgentPay consists of:

- A CLI interface (`agentpay`) for initiating actions
- A local daemon responsible for wallet access, approvals, and signing
- A policy layer that enforces limits and approval rules before any transaction is signed

### Key Characteristics

- Self-custodial: private keys remain on the local machine
- Policy-aware: supports transaction and approval controls
- Human-in-the-loop: optional manual approval workflows
- Local-first: designed around a local signing boundary

### Execution Flow

1. A transaction request is initiated through the CLI.
2. The local runtime evaluates it against configured policies.
3. If approved, the transaction is signed locally.
4. The signed transaction is returned for broadcast.

AgentPay provides secure execution primitives for agent-driven payments, but it primarily solves the signing and policy problem at the runtime boundary.

AgentGuard builds on top of these primitives without modifying the underlying signing or custody model.

## Where AgentGuard Fits

AgentPay answers:

> Can this transaction be safely signed?

AgentGuard answers:

> Should this transaction be attempted at all?

AgentGuard introduces a control layer for:

- Coordination across agents
- External approvals and workflows
- Monitoring and visibility
- System-level decision making

This makes AgentPay easier to use in real-world, multi-agent environments where execution safety depends on more than a local policy file.

## Example

AI attempts to send $100:

❌ Blocked — exceeds $50 limit

AI attempts to send $10:

✅ Allowed

## Architecture

```text
AI Agent
   |
   v
AgentGuard (validation + control)
   |
   v
AgentPay CLI / daemon (policy + signing)
   |
   v
Blockchain (USD1 transfer)
```

## Deep Dive: AgentPay Architecture

A detailed technical analysis of the AgentPay SDK covers:

- Architecture breakdown (CLI + Rust daemon + policy engine)
- Supported vs unsupported surfaces
- Security model and trust boundaries
- Integration strategy for AgentGuard

See full analysis: [`analysis/worldliberty-agentpay-sdk-analysis.md`](analysis/worldliberty-agentpay-sdk-analysis.md)

## Features (v0.1.0)

- Pre-execution validation
- Per-transaction spending limits
- Basic policy checks
- Local transaction logging

## Quick Start

```bash
git clone https://github.com/aitrailblazer/ait-agent-guard.git
cd ait-agent-guard
```

Initial implementation is in progress. Install and run commands will be added once the first runnable prototype is committed.

## Status

Early prototype.

- Not audited
- Not production-ready
- Intended for experimentation and development

## Security Notice

This project introduces additional logic around financial transactions.

- Always review the code before use
- Do not use with significant funds
- No warranties or guarantees

## Relationship to AgentPay

AgentGuard is not affiliated with World Liberty Financial (WLFI).

It is an independent open-source project designed to extend the AgentPay SDK with an additional control layer.

## About the Author

Built by AITrailblazer.

This project builds on prior work in agent orchestration and real-world execution systems.

## Roadmap

- Integration with AgentPay CLI for real transaction flows
- CLI wrapper (`agent-guard transfer`)
- Slack or external approval flows
- Multi-agent budget coordination
- Observability dashboard
- Advanced policy engine

## License

MIT
