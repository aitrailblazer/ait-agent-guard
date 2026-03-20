# World Liberty / AgentPay SDK Analysis

Scope: local repo inspection of `repos/worldliberty/agentpay-sdk`. This is an architecture and product-surface analysis, not a full code audit.

## Executive Summary


AgentPay SDK is not just an npm package. It is a multi-runtime monorepo whose real product is a local transaction-control boundary: a Node/TypeScript CLI on top of a Rust daemon and policy engine, with AI-agent installation surfaces layered around it.

AgentPay is best understood as a local transaction-control boundary for agent-driven payments, not a general-purpose SDK.

The supported `v0.1.0` product surface is narrower than the repo shape suggests. The reliable core is:

- macOS-first local runtime
- self-custodial wallet lifecycle
- local daemon-managed signing
- policy enforcement before signature production
- local manual approval workflows
- CLI/TUI-centered operations

The repo also contains web and relay approval code, but those surfaces are explicitly marked as unsupported in this release. They should be treated as future-facing or compatibility code, not as stable integration contracts.

For `AgentGuard`, the strongest near-term fit is to sit above AgentPay as a pre-execution control layer that decides whether a transaction should be attempted, then delegates actual signing/execution to AgentPay. That is a better match than trying to replace AgentPay policy internals or depending on the unsupported web/relay stack.

## Repo Shape

At the top level, the repo is a monorepo with four meaningful layers:

1. TypeScript CLI and orchestration layer
   - `src/cli.ts`
   - `src/lib/*`
   - `packages/config`
   - `packages/rpc`

2. Rust execution and policy runtime
   - `crates/vault-daemon`
   - `crates/vault-policy`
   - `crates/vault-signer`
   - `crates/vault-cli-admin`
   - `crates/vault-cli-agent`
   - `crates/vault-cli-daemon`
   - transport crates for unix sockets and XPC

3. Adjacent application surfaces
   - `apps/web`
   - `apps/relay`

4. Agent-distribution surfaces
   - `skills/agentpay-sdk`
   - installer scripts
   - workspace adapter installation logic

This is important: AgentPay is built as an operator product plus AI-agent distribution system, not only as a blockchain wallet library.

## What Looks Stable vs Unstable

### Stable enough to build around now

- `agentpay` CLI as the main entrypoint
- local config model in `packages/config`
- Rust daemon as the signing and policy boundary
- manual approval lifecycle through local admin CLI commands
- JSON-capable command outputs for automation
- wallet setup, backup, restore, and reuse flows
- built-in token/network model with USD1-first defaults

### Present in code but intentionally not release-supported

- `apps/relay`
- `apps/web`
- browser-oriented approval transport
- remote approval coordination

The strongest evidence is direct:

- `apps/relay/README.md` says the relay is legacy, unsupported, and not part of the supported approval flow
- `apps/relay/package.json` and `apps/web/package.json` route `dev` and `start` through `scripts/unsupported-release-surface.mjs`
- `scripts/unsupported-release-surface.mjs` exits immediately with an unsupported message
- `releases/v0.1.0.md` says relay, gasless, and EIP-3009 are planned next-release areas, not current supported product surfaces

Conclusion: do not anchor AgentGuard on relay/web as if they are production contracts today.

## Architecture Reading

## Mental Model

AgentGuard (decision layer)
        ↓
AgentPay CLI
        ↓
Rust Daemon (policy + signing)
        ↓
Blockchain

### 1. TypeScript layer is the orchestrator, not the trust anchor

`src/cli.ts` is the main command surface. It wires together:

- config resolution
- RPC reads and estimates
- auth token handling
- wallet status and setup flows
- Rust binary invocation
- output formatting
- manual approval resume behavior
- built-in CLI plugins such as Bitrefill

This layer is operationally important, but it is not the final trust boundary. It delegates the actual secured signing path into the Rust binaries and daemon.

### 2. Rust workspace is the real execution core

The Cargo workspace splits responsibilities cleanly:

- `vault-daemon`: daemon runtime and stateful signing boundary
- `vault-policy`: policy evaluation logic
- `vault-signer`: signing and key material interaction
- `vault-domain`: shared domain model
- `vault-sdk-agent`: agent-facing runtime interfaces
- `vault-transport-unix` and `vault-transport-xpc`: local transport layers
- CLI crates for admin, agent, and daemon operations

That split is a strong sign the team is treating signing, policy, and transport as separable concerns instead of burying everything in a single CLI.

### 3. Config is local, shared, and policy-aware

`packages/config/src/index.ts` shows that local config is not just connection metadata. It includes:

- chain profiles
- token profiles
- default policy thresholds
- destination overrides
- manual approval policy ranges
- wallet profile metadata

The repo encodes built-in defaults for:

- EVM chains
- USD1 on Ethereum and BSC
- native assets for gas

That makes AgentPay more opinionated than a generic wallet SDK. It is already a payment runtime with a preferred operating model.

### 4. Policy attachment is explicit and stateful

`src/lib/wallet-setup.ts` makes it clear setup includes:

- policy scope
- policy limits
- policy attachment mode
- explicit policy IDs
- trusted daemon socket and RPC preflight checks
- security notes about password transport and bootstrap cleanup

This matters for AgentGuard. AgentPay is not merely checking a transaction ad hoc; it is attaching policy state to a wallet/runtime context.

## Security and Trust Posture

This repo is materially more serious about local trust than many agent-wallet projects.

### Strong signals

- Secrets are intended to stay local.
- The README and skill docs repeatedly steer vault/password handling to local prompts.
- `src/lib/admin-guard.ts` explicitly blocks insecure password input patterns such as inline `--vault-password` and `AGENTPAY_VAULT_PASSWORD`.
- `src/lib/fs-trust.ts` validates ownership, permissions, and symlink ancestry for sensitive paths.
- `src/lib/passthrough-security.ts` validates daemon socket selection before forwarding commands.
- `src/lib/rpc-guard.ts` enforces chain-id matching between expected and actual RPC endpoint.
- README and release notes keep manual approval local-first in `v0.1.0`.

### What that implies

The authors care about:

- preventing secret leakage through argv/env
- defending local IPC and filesystem trust boundaries
- reducing misconfiguration risk around RPC and daemon sockets
- keeping private keys and approval boundaries on-machine

This is exactly the kind of execution substrate that an external control layer should use instead of reimplementing.

## Product Maturity

The repo is early but not toy-grade.

### Evidence of maturity

- `version: 0.1.0`
- release notes exist for `v0.1.0`
- CI covers JS unit, JS integration/e2e, and Rust tests on macOS
- installer smoke workflow builds precompiled macOS bundles and runs smoke tests
- there are 52 files under `test/`
- there are 50 Rust source files under `crates/*/src`

### Evidence it is still early

- public git history is shallow in this checkout: only three commits are visible
- current release scope is explicitly narrow
- relay/web are present but intentionally unsupported
- release notes still frame several important surfaces as next-release work

Net read: early-stage but deliberate. Good foundation, not yet broad platform maturity.

## Distribution Strategy

One of the strongest strategic signals in the repo is that AI-agent tooling is first-class, not an afterthought.

The installer and README support:

- Codex
- Claude
- Cline
- Goose
- Windsurf
- OpenClaw
- Cursor
- portable and legacy `.agents` paths
- workspace adapters like `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and Copilot instructions

This means AgentPay is already thinking about agent-driven operation, onboarding, and prompt-surface distribution. That makes `AgentGuard` conceptually aligned with the repo, but it does not mean AgentPay itself already provides the higher-level orchestration layer you want.

## Why This Matters

Most agent payment systems fail by combining decision logic and execution in the same layer.

AgentPay separates these concerns by enforcing policy and signing locally.

This creates a clean boundary where external systems like AgentGuard can introduce higher-level decision making without breaking the trust model.

## Integration Implications for AgentGuard

### Best near-term posture

AgentPay is fundamentally a single-machine, local execution system.

It does not natively coordinate multiple agents or distributed workflows.

**AgentGuard should treat AgentPay as the execution boundary and signing substrate.**

AgentGuard should own:

- intent validation before any payment command is attempted
- higher-level spending and coordination rules that cut across multiple agents
- visibility, logging, and orchestration outside the local daemon
- optional external approval routing and audit workflows

AgentPay should continue to own:

- wallet custody
- local secret handling
- signing
- local policy enforcement
- final transaction submission path

This division maps well onto the repo as it exists today.

### Good integration patterns

1. Preflight wrapper around the CLI
   - validate destination, amount, chain, token, time window, agent identity, and business policy
   - only call `agentpay transfer`, `agentpay approve`, `agentpay broadcast`, or plugin flows after AgentGuard allows it

2. JSON-driven automation
   - consume `agentpay` JSON outputs rather than scraping plain text
   - use local approval queue and resume commands as explicit workflow states

3. Shared-config aware control
   - read the same local config concepts AgentPay uses
   - avoid mutating live daemon policy state behind the user’s back
   - if policy changes are required, route them through supported admin flows

4. External observability
   - keep audit logging and cross-agent coordination outside the daemon
   - do not try to overload the daemon into being a fleet coordinator

### Integration patterns to avoid for now

1. Building on `apps/relay` or `apps/web` as if they are stable
2. Asking users to hand secrets into chat or env vars
3. Replacing Rust policy logic before understanding its state model
4. Reaching directly into local daemon internals when the CLI already expresses the supported path

## Notable Design Strengths

- Clear separation between orchestration and signing
- Good local trust-boundary discipline
- Explicit manual approval lifecycle
- Built-in recovery and backup flows
- AI-agent installation treated as a real product concern
- Plugin model exists already, with Bitrefill as a concrete example

## Notable Risks or Constraints

### 1. macOS-first runtime

The supported release is clearly optimized around macOS. If AgentGuard wants wider operator reach later, portability will matter.

### 2. Unsupported remote approval surfaces

The repo contains tempting code for relay/web approvals, but the release stance is clear: unsupported. Building AgentGuard on those paths now would create dependency on unfinished product surface.

### 3. Source duplication in TypeScript areas

The repo tracks `.ts` and `.js` files side-by-side in `src/` and `packages/`. That may be intentional for packaging, but it increases maintenance overhead and creates more room for drift if discipline slips.

### 4. Early public history

Short visible history does not mean poor quality, but it does mean less long-horizon signal about compatibility, migration stability, and operational incidents.

## Bottom Line
`repos/worldliberty/agentpay-sdk` is a credible local execution substrate for `AgentGuard`.

The right reading is:

- AgentPay is the execution layer.
- AgentGuard should be the decision layer.
- The supported integration surface today is CLI/TUI/local approval, not browser relay.

That separation is the correct way to build on this system.

If I were designing `AgentGuard` against this repo today, I would start with:

1. a strict pre-execution wrapper around `agentpay`
2. local audit logging and decision records
3. optional external approval/workflow orchestration outside AgentPay
4. no dependency on `apps/web` or `apps/relay` until they are officially supported

That path matches both the repo’s real architecture and the current maturity of its supported surfaces.
