# Webmaker Production Roadmap

## Purpose

This document is the source of truth for moving Webmaker from a high-level frontend generation POC into a real agentic website/app builder.

The new direction is explicit:

- stop treating Sandpack/Codesandbox-style preview as the main runtime
- build a local real-runtime implementation first
- keep the runtime provider abstraction clean enough to swap in Cloudflare Sandbox later
- make the agent verify and repair projects from actual install/build/dev-server feedback
- support stable public preview links through the Webmaker app, not through unreliable third-party preview state

Webmaker should become a practical frontend-focused agentic builder, not a demo that only renders generated files in a browser sandbox.

## Product Goal

Webmaker should let a user describe a website or app, then produce a runnable frontend project that can be edited, previewed, debugged, exported, and shared.

Target behavior:

- user prompts for a frontend project
- agent creates or edits a real workspace
- dependencies are installed in a real runtime
- project build/dev server is executed
- compile/runtime errors are captured
- agent receives structured feedback and fixes issues
- preview is served from the actual running app
- public share links are stable and owned by Webmaker
- project can be exported as a normal runnable codebase

## Current Reality

Webmaker already has useful agentic foundations:

- streaming generation through `POST /api/generate`
- a model-driven loop in `lib/agent-runtime.ts`
- file/workspace tools in `lib/agent-tools.ts`
- tools for `plan`, `inspect`, `search`, `read`, `create`, `edit`, `patch`, `rename`, `delete`, `verify`, and `complete`
- per-session `GeneratedProject` and `WorkspaceSnapshot`
- Studio UI with chat, sessions, code view, preview panel, skill picker, export, and preview sharing
- optional dashboard/session persistence

But the runtime is not yet real enough:

- `run_command` does not execute commands
- `install_dependencies` does not install packages
- `verify_build` does not run a build
- logs are not process logs
- preview is still browser/runtime-simulated instead of a real dev server
- the agent cannot reliably self-repair from actual TypeScript/Vite/npm errors
- public share links depend on generated snapshots, not a running preview/runtime flow

This is a real agentic POC, but not yet a Lovable/Bolt-class execution system.

## Strategic Decision

### Local Runtime First

Build the real runtime locally before integrating Cloudflare Sandbox.

Reasons:

- fastest path to prove the real agent loop
- avoids blocking on external SDK/API design
- gives concrete provider requirements before Cloudflare integration
- makes debugging simpler
- keeps the product moving immediately

The local runtime is not the final SaaS isolation model. It is the first concrete implementation of the runtime contract.

### Cloudflare Sandbox Later

Cloudflare Sandbox should be added later as a second provider behind the same interface.

Requirements before Cloudflare work:

- runtime provider interface is stable
- local provider proves install/build/dev/log/preview behavior
- agent can use runtime tool results to repair code
- preview/share model is defined
- command allowlist and process lifecycle are already designed

### Sandpack Is Secondary

Sandpack can remain as a fallback or lightweight client preview, but it should no longer be the core execution model.

Priority order:

1. real runtime preview
2. stable Webmaker-owned public preview/share links
3. export ZIP
4. Sandpack fallback

## Target Architecture

### Layer 1: Studio UI

Owns:

- chat experience
- activity feed
- file/code viewer
- preview iframe
- runtime status
- command/build/log panels
- session switching
- manual repair prompts
- export/share actions

### Layer 2: Agent Orchestrator

Owns:

- model conversation loop
- tool-call parsing
- tool execution
- workspace mutation
- runtime verification flow
- error feedback loop
- completion gating

Completion should be blocked until required verification succeeds or the agent explicitly reports unresolved issues.

### Layer 3: Agent Tools

Owns:

- file tools
- search/read tools
- patch/edit tools
- project metadata tools
- runtime tools
- verification tools
- structured tool result envelopes

Long term, split `lib/agent-tools.ts` into modular handlers.

### Layer 4: Runtime Provider

Owns:

- workspace materialization
- dependency install
- command execution
- process lifecycle
- dev-server preview
- build verification
- logs
- cleanup
- provider-specific metadata

Providers:

- `local`: immediate implementation
- `cloudflare-sandbox`: future implementation
- `virtual`: fallback only

### Layer 5: Preview And Sharing

Owns:

- live preview URL for current workspace
- stable public share route
- preview snapshot route
- optional proxy to running dev server
- preview metadata persistence

Sharing should not depend on Codesandbox/Sandpack reliability.

### Layer 6: Persistence

Owns:

- session state
- project snapshots
- workspace IDs
- preview IDs
- runtime metadata
- share links
- user/device state

For local POC, filesystem/localStorage/optional Redis is acceptable. For production, preview and workspace metadata need durable storage.

## Runtime Provider Contract

Create a provider abstraction that supports:

- `loadWorkspace(workspace)`
- `writeProject(workspace, project)`
- `readProject(workspace)`
- `installDependencies(workspace)`
- `runCommand(workspace, command, options)`
- `startDevServer(workspace)`
- `stopProcess(workspace, processId)`
- `getLogs(workspace, processId?)`
- `verifyBuild(workspace)`
- `getPreview(workspace)`
- `cleanupWorkspace(workspace)`

Every method should return a structured result:

```ts
interface RuntimeResult<T = unknown> {
  ok: boolean;
  workspace: WorkspaceSnapshot;
  data?: T;
  output?: string;
  error?: string;
  structuredErrors?: RuntimeIssue[];
}
```

## Runtime Issues

Normalize runtime failures so the agent can repair instead of guessing.

Minimum shape:

```ts
interface RuntimeIssue {
  type:
    | "install_error"
    | "missing_dependency"
    | "typescript_error"
    | "vite_error"
    | "build_error"
    | "runtime_error"
    | "console_error"
    | "process_error";
  message: string;
  file?: string;
  line?: number;
  column?: number;
  command?: string;
  packageName?: string;
  raw?: string;
}
```

Minimum parsers:

- npm install failures
- missing package/module errors
- TypeScript diagnostics
- Vite import/build errors
- React runtime stack traces
- browser console errors where available

## Agent Runtime Loop Target

The agent loop should evolve toward this:

```text
agent.plan
agent.inspect
agent.create / agent.edit / agent.patch
runtime.sync_workspace
runtime.install_dependencies
runtime.verify_build

if build fails:
  agent.read affected files
  agent.patch / agent.edit
  runtime.verify_build

runtime.start_preview
runtime.get_logs

if preview/runtime fails:
  agent.read affected files
  agent.patch / agent.edit
  runtime.verify_build
  runtime.start_preview

agent.complete
```

`agent.complete` should only succeed when:

- project has files
- entry exists
- imports resolve
- dependencies align
- install completed or was not needed
- build passed
- preview is available or explicit fallback is accepted

## Public Preview Strategy

Public sharing should be owned by Webmaker.

### Local POC

Use Webmaker routes as the stable public URL:

- `/preview/:id` for saved snapshots
- `/api/preview/:id` for preview payloads
- optional local runtime proxy for active workspaces

For local-only development, public internet sharing may require a tunnel such as Cloudflare Tunnel, ngrok, or a deployed Webmaker instance. The app should still generate stable share IDs and routes.

### Production

Cloudflare Sandbox or another hosted runtime should expose preview targets through Webmaker-controlled URLs.

Do not expose raw provider URLs as the permanent public link. Provider URLs can be implementation details.

Target:

```text
https://webmaker.app/p/{previewId}
```

Internally this can resolve to:

- saved static snapshot
- live runtime preview
- deployed artifact
- fallback exported bundle

## Security And Safety

Local runtime is powerful and must be treated carefully.

Immediate local POC safety:

- command allowlist
- workspace root isolation under a controlled directory
- no arbitrary shell strings from the model without validation
- process timeouts
- max output size
- max workspace size
- cleanup stale workspaces
- block destructive commands outside workspace
- do not pass secrets into generated apps

Initial command allowlist:

- `npm install`
- `npm run build`
- `npm run dev`
- `npm test`
- `npm run lint`

Avoid general shell execution until the runtime is isolated.

## Implementation Phases

### Phase 1: Local Runtime Foundation

Goal: replace placeholder runtime responses with real local execution.

Tasks:

- define `WorkspaceProvider` interface
- implement `LocalWorkspaceProvider`
- create per-session workspace directories
- write `GeneratedProject.files` to disk
- generate or update `package.json`
- implement dependency install with timeout
- implement command execution with captured stdout/stderr
- implement build verification
- implement process registry for dev server
- implement log retrieval
- update `lib/runtime-service.ts` to call the provider

Exit criteria:

- clicking runtime/build actions runs real commands
- `verify_build` returns real success/failure
- logs show actual process output
- workspace files exist on disk

### Phase 2: Real Preview

Goal: preview the actual running app, not a browser simulation.

Tasks:

- start Vite dev server per workspace
- assign available local ports
- store preview URL in `WorkspaceSnapshot.runtime.preview`
- render preview iframe from real URL
- add restart preview action
- add stop preview action
- surface preview startup errors
- keep Sandpack as fallback only

Exit criteria:

- generated app is visible from a real dev server
- preview survives UI refresh when process is still alive
- failed preview startup shows actionable logs

### Phase 3: Runtime Tools In Agent Loop

Goal: make the model use real runtime feedback.

Tasks:

- add runtime tool names to the agent callable tool set
- implement runtime tool execution in the agent loop
- add `runtime.sync_workspace`
- add `runtime.install_dependencies`
- add `runtime.verify_build`
- add `runtime.start_preview`
- add `runtime.get_logs`
- require build verification before completion
- feed failed runtime tool results back to the model

Exit criteria:

- agent can build, see failure, patch code, and rebuild
- final completion is gated by real verification
- activity feed shows runtime steps clearly

### Phase 4: Structured Error Parsing

Goal: turn logs into repairable diagnostics.

Tasks:

- parse TypeScript errors
- parse Vite module/import errors
- parse npm missing package errors
- parse dependency install failures
- parse runtime stack traces where possible
- attach file/line/column when available
- display structured errors in Studio
- prioritize structured errors in the system prompt

Exit criteria:

- build failures produce `RuntimeIssue[]`
- agent reads/patches the relevant files without guessing from raw logs only
- user can understand failures from the UI

### Phase 5: Stable Share Links

Goal: make public sharing reliable and Webmaker-owned.

Tasks:

- define preview/share record schema
- save preview snapshots with stable IDs
- keep `/preview/:id` or equivalent route stable
- separate snapshot preview from live runtime preview
- add share action that stores current project/runtime metadata
- make share links work without Codesandbox
- document local-public sharing limitations

Exit criteria:

- every project can create a stable share URL
- share URL loads independently from the active Studio session
- share does not depend on Codesandbox/Sandpack state

### Phase 6: Workspace Source Of Truth

Goal: move from `GeneratedProject` as the authoring truth toward filesystem-backed workspace truth.

Tasks:

- read project state from runtime workspace after edits
- make export read from workspace
- detect drift between `GeneratedProject` and workspace files
- make sync behavior explicit
- eventually treat `GeneratedProject` as a serialized snapshot only

Exit criteria:

- runtime workspace is authoritative during active sessions
- UI/project snapshot can be reconstructed from files
- export matches what was built and previewed

### Phase 7: Cloudflare Sandbox Provider

Goal: add hosted isolated execution without changing the agent contract.

Tasks:

- review Cloudflare Sandbox SDK/docs when available
- implement `CloudflareSandboxProvider`
- map provider methods to Sandbox APIs
- sync workspace files to Sandbox
- install dependencies in Sandbox
- run build/dev server in Sandbox
- retrieve logs
- expose preview through Webmaker-owned share/proxy routes
- enforce resource limits and cleanup

Exit criteria:

- provider can switch from `local` to `cloudflare-sandbox`
- agent loop behavior remains unchanged
- hosted previews work without local machine dependency

### Phase 8: Product Hardening

Goal: make the system reliable enough for serious users.

Tasks:

- add auth if public
- add quotas and rate limits
- add workspace cleanup jobs
- add telemetry for generation/build/fix success rate
- add command/resource audit logs
- add dependency cache strategy
- add regression tests for runtime providers
- add eval prompts for common app/site generation
- add crash recovery for running processes

Exit criteria:

- failures are observable
- workspaces do not leak resources
- runtime costs are bounded
- common prompts pass repeatable quality checks

## Immediate Next Tasks

Do these first:

1. Replace virtual-only runtime behavior in `lib/runtime-service.ts`.
2. Add a local runtime provider that writes files to `.webmaker/workspaces/<workspaceId>`.
3. Implement real `npm install`, `npm run build`, and `npm run dev`.
4. Capture stdout/stderr and expose it through `get_logs`.
5. Store preview URL and process IDs in `WorkspaceSnapshot.runtime`.
6. Add build verification to the agent completion path.
7. Add stable share snapshots independent of Codesandbox/Sandpack.

## Non-Goals For Now

- backend app generation
- database provisioning
- authentication wiring for generated apps
- arbitrary shell access from the model
- multi-user collaborative editing
- production Cloudflare Sandbox integration before local runtime is proven
- replacing the whole UI before runtime correctness improves

## Decision Log

- **2026-04-29:** Move away from Codesandbox/Sandpack as the primary runtime path.
- **2026-04-29:** Build a local real-runtime provider first.
- **2026-04-29:** Keep Cloudflare Sandbox as the future hosted provider behind the same runtime interface.
- **2026-04-29:** Public sharing must be Webmaker-owned and stable, not dependent on third-party preview reliability.

## Definition Of Done For The Next Major Milestone

Webmaker reaches the next milestone when:

- a generated React/Vite project is written to a real local workspace
- dependencies install successfully
- build runs successfully or returns structured errors
- agent can repair at least common build/import/dependency failures
- preview runs from a real dev server
- user can open a stable Webmaker share link
- export ZIP matches the verified workspace
