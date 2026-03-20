# AgentGuard

Control layer for AgentPay and USD1.

AgentGuard is a pre-execution governance layer for AI-driven financial operations. It sits above AgentPay to evaluate whether a transaction should be attempted before that transaction reaches the signing boundary.

> AgentPay secures execution. AgentGuard governs intent.

| Status | Early prototype |
| --- | --- |
| Focus | Safer AI-driven payments and approvals |
| Built on | AgentPay |
| License | MIT |

## Why It Exists

AI agents can move money faster than most systems can review intent.

The missing layer is not another wallet. The missing layer is a control plane that can:

- validate proposed transactions before execution
- enforce system-level spending rules
- support human review when needed
- add visibility across multiple agents and workflows

AgentGuard is designed to provide that layer while leaving custody, signing, and local policy enforcement to AgentPay.

## AgentGuard and AgentPay

AgentPay is the execution runtime.

AgentGuard is the decision and coordination layer above it.

| Responsibility | AgentGuard | AgentPay |
| --- | --- | --- |
| Decide whether a transaction should be attempted | Yes | No |
| Enforce system-level orchestration rules | Yes | Limited |
| External approval and workflow coordination | Planned | Local-first manual approval |
| Audit and visibility across agents | Yes | Partial |
| Wallet custody | No | Yes |
| Local signing | No | Yes |
| Policy-aware transaction execution | No | Yes |

## What Is AgentPay?

AgentPay is a local, self-custodial runtime for executing blockchain transactions with built-in policy enforcement.

It is developed by World Liberty Financial (WLFI) and released as an open-source SDK.

Official site: [agentpay.worldlibertyfinancial.com](https://agentpay.worldlibertyfinancial.com/)

At a high level, AgentPay consists of:

- a CLI interface (`agentpay`) for initiating actions
- a local daemon responsible for wallet access, approvals, and signing
- a policy layer that enforces limits and approval rules before any transaction is signed

### AgentPay Characteristics

- Self-custodial: private keys remain on the local machine
- Policy-aware: supports transaction and approval controls
- Human-in-the-loop: supports manual approval workflows
- Local-first: keeps the signing boundary on the operator's machine

### AgentPay Execution Flow

1. A transaction request is initiated through the CLI.
2. The local runtime evaluates it against configured policies.
3. If approved, the transaction is signed locally.
4. The signed transaction is returned for broadcast.

AgentPay solves secure execution.

AgentGuard is intended to add a higher-level layer for deciding whether execution should happen in the first place.

## Example Decision

Requested action:

```text
Transfer 100 USD1 to recipient X
```

System rule:

```text
Autonomous spend limit for this agent is 50 USD1
```

Outcome:

```text
Blocked before AgentPay execution
```

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

## Current Repository Status

This repository is currently a public project-definition and architecture repo.

What exists today:

- product positioning and system framing
- integration analysis of the AgentPay SDK
- initial roadmap and scope definition

What does not exist yet:

- a runnable production implementation
- a completed AgentPay integration
- an audited release

## Planned Initial Capabilities

- pre-execution transaction validation
- per-transaction spending limits
- higher-level policy checks above the execution runtime
- local transaction logging and audit records
- AgentPay CLI integration for real transaction flows

## Repository Contents

- [`README.md`](README.md): public overview and positioning
- [`analysis/worldliberty-agentpay-sdk-analysis.md`](analysis/worldliberty-agentpay-sdk-analysis.md): technical analysis of the AgentPay SDK and integration strategy

## Deep Dive: AgentPay Architecture

The technical analysis covers:

- CLI plus Rust daemon architecture
- supported versus unsupported surfaces
- security model and trust boundaries
- integration strategy for AgentGuard

Read the full analysis here:

- [`analysis/worldliberty-agentpay-sdk-analysis.md`](analysis/worldliberty-agentpay-sdk-analysis.md)

## Security Notice

This project is about introducing additional control logic around financial transactions.

- Review all code before use
- Do not use with significant funds
- Expect breaking changes during early development
- Treat all examples as experimental until a real implementation is released

## Relationship to AgentPay

AgentGuard is not affiliated with World Liberty Financial (WLFI).

It is an independent open-source project intended to extend the AgentPay SDK with a separate control and coordination layer.

## Roadmap

- CLI wrapper (`agent-guard transfer`)
- integration with AgentPay command flows
- external approval workflows
- multi-agent budget coordination
- observability and audit dashboard
- advanced policy engine

## About

Built by AITrailblazer.

AgentGuard is part of ongoing work around agent orchestration, real-world execution, and safer control systems for autonomous financial operations.

## License

MIT
