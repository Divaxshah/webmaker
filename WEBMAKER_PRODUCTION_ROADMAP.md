# Webmaker Production Roadmap

## Purpose

This document is the living source of truth for turning `webmaker` from a prompt-to-frontend generator into a production-grade AI website/app builder in the class of Lovable, Bolt, and similar tools.

It captures:

- product direction
- current-state assessment
- target architecture
- major gaps
- implementation phases
- concrete tasks and TODOs
- decisions and open questions

Update this file as work progresses. Completed items should be checked off, and any major scope changes should be reflected here before implementation drifts.

**Snapshot (Apr 2026):** Webmaker supports optional **Cloudflare Sandbox** via **gateway Worker**, **runtime sync/logs/verify**, **dashboard session persistence** (Redis), **`agent.patch`**, Studio **preview mode toggles** (Sandpack vs live iframe), and **reconnect/restart preview** flows. **`GeneratedProject`** is still the agent’s primary project truth; the sandbox is kept aligned via explicit sync—not a unified filesystem-only architecture yet.

## Product Goal

Webmaker should become a real AI-powered frontend building environment, not only a project JSON generator.

Target outcome:

- users can prompt for a website or app
- the agent works against a real workspace, not only an in-memory file map
- generated projects can be edited, run, previewed, debugged, and refined iteratively
- the system supports stronger tools, better verification, and specialized skills
- the product feels reliable enough for serious use, not only demos

## Product Positioning

Webmaker should aim to be:

- a frontend-focused AI builder
- stronger at design quality than generic coding agents
- better guided than raw chat interfaces
- more structured and reliable than basic “one-shot code generation”

Differentiators we should lean into:

- frontend-first workflows
- strong design direction and UI polish
- real multi-file project generation
- preview and iteration loop
- skills for domain-specific generation and refinement

## Current State Summary

### Implemented

- **Studio UX**: chat, sessions, skill picker, Sandpack preview, optional **live iframe** when a sandbox preview URL exists (**Live iframe vs Sandpack** toggle), ZIP/export flows, shareable preview (`/api/preview`).
- **Agent**: streaming **`POST /api/generate`** (NDJSON), tool loop in **`lib/agent-tools.ts`**, prompts from **`Agent Prompt.txt`** + **`Agent Tools.json`**, skills injected by id (**`/api/skills`**, built-in markdown skills).
- **Workspace model**: **`WorkspaceSnapshot`** + **`GeneratedProject`** per session; runtime metadata (preview URL, **`previewProcessId`** in `providerMeta`, last command/output/error).
- **Sandbox alignment**: client sends **`sessionWorkspace`** with generation; tools merge **`syncProjectToWorkspace(sessionWorkspace, project)`** so sandbox/workspace ids match Studio; after generation completes, **`sync_workspace`** runs for **`sandbox`** provider sessions when gateway is configured.
- **Cloudflare Sandbox (optional)**: HTTP **`SANDBOX_GATEWAY_URL`** + **`SANDBOX_GATEWAY_SECRET`** → **`workers/sandbox-gateway`** Worker: file sync, exec, preview start/stop, status, process logs. **`DEPLOY.md`** documents Worker + env wiring; **`GET /api/health`** surfaces config checks.
- **Runtime API**: **`POST /api/runtime`** — `status`, `start_preview`, `stop_preview`, `run_command`, `install_dependencies`, **`sync_workspace`**, **`get_logs`** (poll; optional **`processId`**), **`verify_build`** (sync + **`npm run build`** in sandbox).
- **Studio runtime UX**: **RuntimeControls** (refresh, sync, preview, logs, verify build, commands); **WorkspaceStatus** — **Sync & Restart Preview** (refresh status → sync → start preview).
- **Tools**: `agent.plan`, `agent.inspect`, `agent.search`, `agent.read`, `agent.create`, `agent.edit`, **`agent.patch`** (search/replace, optional replace-all), `agent.rename`, `agent.delete`, **`agent.verify`** (local checks + optional **sandbox `npm run build`** via **`sandboxBuild`** / **`sandbox build`** check), `agent.complete`.
- **Tool catalog**: **`lib/tool-registry.ts`** + parity with **`Agent Tools.json`** (still executed mainly from one module — modular split pending).
- **Persistence**: optional **Upstash** — **`/api/dashboard-session`** persists sessions/active session/skills/last prompt; **`useDashboardSessionSync`** hydrates when newer than device cache; without Redis, **zustand + localStorage** only.
- **Dev**: **`next.config.ts`** Turbopack **`root`** + **`resolveAlias`** for **`tailwindcss`** when the monorepo root has **`package.json`** but no **`node_modules`** — always run **`npm`** from **`webmaker/`**.

### Still open / partial

- **Source of truth**: authoring remains **`GeneratedProject`** in the agent; sandbox FS is **mirrored**, not the sole canonical tree end-to-end.
- **Tool architecture**: modular **per-tool files**, richer standardized tool results, stronger availability gates — **partially done** (registry exists; **`agent-tools.ts`** not split).
- **Verification**: local + sandbox **`npm run build`** exists; deeper **runtime preview verification**, structured **compile-error → agent** loops, and **tiered** verification policies — **still open**.
- **Logs**: **polling** via gateway; **SSE/WebSocket terminal** not implemented.
- **Skills**: manual selection + injection done; **auto-suggested skills**, larger curated library — **open**.
- **SaaS productization**: auth, quotas, telemetry — **explicitly deferred** for internal pilot (see Phase 8).

## Core Insight

Webmaker has moved from “**Sandpack-only simulated runtime**” toward “**optional real sandbox + synced project mirror**,” while the agent still edits **`GeneratedProject`** as the immediate truth.

The remaining north-star shift:

`project.files as sole authoring truth` → **`GeneratedProject` ↔ sandbox filesystem kept in sync**, eventually approaching **sandbox-first** editing if product requires it.

The **`GeneratedProject`** model remains central; **`WorkspaceSnapshot`** carries runtime and sync metadata for Studio and gateway operations.

## What We Should Borrow From Hermes

We should borrow patterns from Hermes, not copy Hermes wholesale.

### Keep / adapt from Hermes

- registry-based tool architecture
- tool schemas + handlers + availability checks
- dedicated file tools instead of one giant switch
- path normalization and safety checks
- read/search/edit/write separation
- patch-based editing support
- better verification and consistency checks
- anti-loop protections for repeated reads/searches
- clearer tool results and error messages
- skills as reusable instruction packs
- session-aware tool behavior

### Avoid copying directly

- broad general-purpose tool sprawl
- gateway/messaging platform complexity
- unrelated plugin systems
- CLI-specific behavior that does not fit the Webmaker UX
- unnecessary general-agent features that distract from frontend building

## What We Should Borrow From Lovable / Bolt-Class Products

- real workspace execution
- preview from running apps, not only simulated preview
- iterative fix loop based on runtime/build errors
- real package/dependency installation
- real command execution for builds and dev servers
- shareable live previews
- more trustworthy “edit existing project” behavior
- stronger project lifecycle around create, inspect, run, fix, and export

## Sandbox Direction

**Implemented path:** Cloudflare Sandbox is integrated via a **deployed Worker** (`workers/sandbox-gateway/`) that owns the Sandbox SDK; the Next.js app talks **HTTP only** (`SANDBOX_GATEWAY_URL` + `SANDBOX_GATEWAY_SECRET`). See **`DEPLOY.md`** for hostname/secrets.

We likely want a real sandbox runtime for Webmaker.

Cloudflare Sandbox is a strong candidate because it provides:

- command execution
- file read/write/mkdir
- background services
- preview/service exposure
- websocket terminal support
- file watching
- isolated environments

### Intended role of the sandbox

The sandbox should become:

- the workspace execution layer
- the real filesystem
- the place where installs/builds/dev servers run
- the source for live preview and debugging

The sandbox should not replace:

- the Webmaker product UX
- the chat/studio interface
- the project/session management layer
- the design-oriented product behavior

## Target Architecture

### Layer 1: Product UI

Owns:

- studio layout
- chat panel
- file/code viewer
- preview panel
- sessions
- error display
- skill selection UI
- run/build/debug controls

### Layer 2: Agent Orchestrator

Owns:

- conversation loop
- tool invocation
- planning/editing flow
- model responses
- activity feed
- skill injection
- verification requests

### Layer 3: Tool Runtime

Owns:

- tool registry
- file tools
- search tools
- terminal/process tools
- verification tools
- preview tools
- skill resolution

### Layer 4: Workspace Runtime

Owns:

- sandbox lifecycle
- filesystem
- process execution
- background dev server
- dependency installation
- live preview endpoints
- logs and terminal sessions

### Layer 5: Persistence

Owns:

- session metadata
- project/workspace mapping
- preview IDs
- skill inventory
- saved prompts/templates
- future team/project state

## Target Capabilities

Webmaker should eventually support all of the following:

- generate a new multi-file frontend project
- inspect an existing project
- edit files incrementally
- patch files precisely
- install dependencies
- run dev/build/test commands
- detect runtime/build/import errors
- auto-fix based on tool results
- expose live preview URLs
- provide downloadable project bundles
- retain workspace state per session
- provide optional terminal access
- use skills for specialized generation/refinement

## Major Gaps To Close

Strategic gaps **remaining** (several former gaps are now partially or fully addressed — see **Current State Summary**):

### 1. Source of truth gap (partially mitigated)

- **Still**: `GeneratedProject` is the agent’s editing surface.
- **Mitigated**: explicit **`sync_workspace`** + post-gen sync + **`sessionWorkspace`** keep **sandbox FS** aligned with chat output for Install / Run / Preview.
- **Needed for “full” parity**: optional progression toward **sandbox-authoritative** flows or stronger conflict detection when UI and remote drift.

### 2. Runtime gap (narrowed)

- **Was**: Sandpack-only.
- **Now**: optional **live iframe** + gateway-backed **install / commands / preview / logs / verify build**.
- **Still**: no interactive **terminal streaming** (SSE/WebSocket); logs are **poll-based**.

### 3. Tooling gap (narrowed)

- **Registry + JSON catalog** exist; execution still concentrated in **`lib/agent-tools.ts`**.
- **Needed**: split modules, standardized tool result envelopes, capability gates.

### 4. Editing gap (narrowed)

- **`agent.patch`** (search/replace) shipped.
- **Still**: stale-edit protections, richer patch strategies (unified diff, multi-hunk), serialization under concurrency.

### 5. Verification gap (narrowed)

- Local verification + optional **sandbox `npm run build`** via **`verify_build`** / **`agent.verify`**.
- **Still**: structured compile/runtime error ingestion into the agent loop as first-class tool feedback at scale; preview-runtime assertions.

### 6. Skills gap (narrowed)

- Built-in skills + loader + UI selection + prompt injection.
- **Still**: auto-suggestions, broader packs, eval quality.

### 7. Product maturity gap (depends on audience)

- **Internal pilot**: acceptable without auth/quotas if deployment is **network-restricted**.
- **Still for SaaS**: observability, tenancy, abuse controls (Phase 8).

## Skills Vision For Webmaker

Skills should be a first-class Webmaker feature.

### What skills are for

Skills should help the agent:

- follow stronger domain-specific instructions
- generate higher-quality output for particular use cases
- debug and refine more effectively
- produce more consistent results across sessions

### Example skill categories

- landing-page-design
- saas-dashboard
- ecommerce-storefront
- portfolio-site
- motion-and-interactions
- accessibility-audit
- responsive-polish
- design-system-builder
- component-refactor
- runtime-error-fixer
- import-and-dependency-repair

### Skill design principles

- skills should be small, explicit, and composable
- skills should augment the agent, not replace the core runtime
- skills should be selectable automatically or manually
- skills should be safe to inject into the agent flow
- skills should be visible in the UI so users understand what is active

### Hermes-inspired skill ideas

- markdown-based skill files
- metadata/frontmatter
- tags/categories
- skill loading rules
- optional config per skill
- prompt injection at the right phase of the agent loop

## Proposed Implementation Phases

## Phase 0: Planning And Guardrails

Goal:

- make the direction explicit and reduce thrash

Tasks:

- [x] create this roadmap document
- [x] extract embedded agent tool logic into a dedicated runtime module
- [x] introduce a first-pass workspace abstraction around project state
- [x] introduce a registry-shaped tool catalog for Webmaker tools
- [x] define a clear product vocabulary: session, workspace, project, preview, skill *(documented in code + this roadmap; refine as needed)*
- [x] decide whether sandbox is mandatory or optional in first production version *(**optional** — Sandpack + virtual workspace remain; gateway unlocks live sandbox)*
- [ ] define what “production-grade” means for Webmaker MVP
- [ ] define success metrics for generation quality, preview reliability, and fix-loop reliability

## Phase 1: Runtime And Workspace Foundation

Goal:

- establish a real workspace runtime

Tasks:

- [x] design a first-pass `workspace` abstraction for Webmaker
- [x] map each studio session to a workspace/runtime identity *(via `WorkspaceSnapshot` + session binding in store; gateway uses workspace id as sandbox id)*
- [ ] introduce a dedicated workspace service layer *(partially covered by `runtime-service` + gateway client + workspace helpers)*
- [x] prototype real filesystem-backed project sync *(gateway `sync` + `sync_workspace`)*
- [x] decide how `GeneratedProject` mirrors real files *(push/pull via explicit sync; agent edits project first)*
- [x] define preview lifecycle: start, stop, restart, status *(runtime actions + Studio controls + reconnect flow)*
- [x] define first-pass preview status model in workspace runtime state
- [x] define dependency install lifecycle *(surface: `install_dependencies` → `npm install` in sandbox when configured)*
- [x] define first-pass dependency install action surface
- [x] define command execution lifecycle *(surface: `run_command`; virtual mode shows informative message)*
- [x] define first-pass command execution action surface

Cloudflare Sandbox tasks:

- [x] evaluate exact Cloudflare Sandbox API fit for Webmaker *(Worker + HTTP gateway bridge from Next.js; SDK runs in Worker, not in Next)*
- [x] add first-pass Cloudflare sandbox runtime configuration scaffolding
- [x] design sandbox-per-session or sandbox-per-project model *(current: **workspace id per session** ↔ sandbox id for gateway calls)*
- [x] define filesystem root conventions such as `/workspace` *(see `DEFAULT_WORKSPACE_ROOT` / runtime config)*
- [x] define background server process strategy *(start-preview / stop-preview via gateway)*
- [x] define preview URL exposure strategy *(gateway preview URLs + `exposePort`; hostname via Worker vars — see `DEPLOY.md`)*
- [ ] define terminal websocket strategy *(not implemented — polling only today)*
- [ ] define persistence strategy for workspace state *(Redis stores dashboard blob; sandbox durability is provider-side)*

## Phase 2: Tool System Refactor

Goal:

- move from pseudo-tools in one file to a proper tool runtime

Tasks:

- [x] define a first-pass Webmaker tool registry
- [x] move tool schemas out of the single embedded switch model *(schemas live in `Agent Tools.json`; prompts reference them)*
- [x] move current tool execution logic out of the single embedded switch model *(still one `executeAgentTool` module — see below)*
- [ ] split tools into separate modules *(deferred — still `lib/agent-tools.ts`)*
- [ ] add tool availability and capability checks
- [ ] standardize tool result shapes
- [ ] standardize tool error/result messaging
- [x] add agent activity metadata per tool *(Studio activity feed + kinds)*

Target first-class tools *(agent naming vs internal registry)*:

- [x] `agent.plan` *(plan)*
- [x] `agent.inspect` *(inspect workspace)*
- [x] `agent.search` *(search files)*
- [x] `agent.read` *(read files)*
- [x] `agent.create` / `agent.edit` *(write files)*
- [x] `agent.patch` *(patch-style search/replace)*
- [x] `agent.rename` *(rename file)*
- [x] `agent.delete` *(delete file)*
- [x] `install_dependencies` *(via **`POST /api/runtime`** / Studio — not an LLM `agent.*` tool)*
- [x] `run_command` *(same — runtime capability)*
- [x] `start_preview` / `stop_preview` *(runtime)*
- [x] `get_logs` *(runtime — gateway process logs)*
- [x] `verify_project` *(local `agent.verify` + sandbox **`verify_build`** / **`npm run build`** path)*
- [x] `agent.complete`

## Phase 3: File System And Editing Quality

Goal:

- make file work more reliable and Hermes-like

Tasks:

- [x] add path normalization rules
- [ ] add path safety rules
- [ ] support relative and absolute workspace paths cleanly
- [ ] add file-read batching rules
- [ ] add repeated-read loop protection
- [ ] add repeated-search loop protection
- [x] add full-file write support *(create/edit tools)*
- [x] add patch-based editing support *( **`agent.patch`** )*
- [ ] add stale-file detection
- [ ] add per-file locking or serialization strategy
- [ ] improve file search output quality
- [ ] improve read result pagination and truncation strategy

## Phase 4: Verification And Auto-Fix Loop

Goal:

- make the agent able to validate and repair its work

Tasks:

- [x] keep current lightweight import verification as a fast first check
- [x] add dependency verification against imports *(initial checks in `agent.verify`; expanded guards TBD)*
- [x] add build verification *(sandbox: **`verify_build`** / `agent.verify` + **`sandboxBuild`**)*
- [ ] add runtime preview verification
- [ ] add structured compile/runtime error extraction
- [ ] feed errors back into the agent as tool results *(partial — sandbox build stderr/stdout in verify tool result; broader loop TBD)*
- [ ] create a reliable “fix and retry” loop
- [ ] track verification status per workspace

## Phase 5: Skills System

Goal:

- give Webmaker reusable intelligence layers

Tasks:

- [x] define skill file format
- [x] decide skill storage location
- [x] define skill metadata shape
- [x] define skill loading and activation rules
- [x] support manual skill selection
- [ ] support auto-suggested skills based on prompt/project type
- [x] inject skills into the agent prompt safely
- [x] show active skills in the studio UI
- [x] create initial built-in skills

Starter skill candidates:

- [x] frontend-design
- [ ] landing-page-conversion
- [ ] dashboard-builder
- [ ] ecommerce-ui
- [ ] accessibility-polish
- [x] responsive-hardening
- [ ] animation-and-motion
- [x] runtime-error-fixer
- [ ] dependency-repair
- [ ] refactor-to-components

## Phase 6: Preview, Terminal, And Dev Experience

Goal:

- make Webmaker feel like a real builder environment

Tasks:

- [x] support real preview from running workspace app *(when sandbox gateway returns preview URL — iframe in Studio)*
- [x] keep Sandpack as fallback or quick preview mode *(toggle when live URL exists; Sandpack-only without gateway)*
- [x] add first-pass preview status and restart controls
- [x] add first-pass preview/runtime status surfaces in the studio UI
- [x] add first-pass runtime API surface for status/actions
- [x] add terminal/log viewer *(gateway **`get_logs`** + **`lastOutput`** in RuntimeControls — polling, not streaming terminal)*
- [x] add first-pass build/install/runtime action controls
- [ ] add richer console/runtime diagnostics
- [x] add “open file from error” and “fix this” flows *(partial — runtime error banner / share prompt to chat; refine as needed)*

## Phase 7: Persistence And Reliability

Goal:

- make sessions durable and trustworthy

Tasks:

- [x] define persistence model for workspace metadata *(dashboard blob: sessions + active session id + skills + last prompt — Redis / optional)*
- [x] persist session -> workspace mapping *(within session payload + workspace snapshot on session)*
- [ ] persist preview metadata separately *(preview URL lives on runtime state today; no separate DB table)*
- [x] persist active skills per session/project *(in session + server sync when Redis on)*
- [ ] handle interrupted generation safely *(partial — client preserves partial state; formal recovery TBD)*
- [x] handle sandbox restart/reconnect flows *(Sync & Restart Preview + refresh status + sync + start preview)*
- [ ] define cleanup and retention policies
- [x] add recovery path when previews or processes die *(reconnect flow + manual restart — automated watchdog TBD)*

## Phase 8: Productization

Goal:

- make the system usable as a serious product *(full SaaS scope)*

Tasks:

- [ ] add usage controls and quota awareness
- [ ] add telemetry/observability for failures
- [ ] add admin/debug visibility for agent/tool/runtime failures
- [ ] improve empty/loading/error states
- [ ] improve onboarding and examples
- [ ] improve project naming/export/import flows
- [ ] define pricing-aligned capability tiers

**Internal pilot note:** auth, quotas, and telemetry are **not required** for a **trusted small team** if deployment is **network-restricted**; revisit before any public or multi-tenant launch.

## Recommended Build Order

Do this first *(many items shipped — treat remainder as backlog)*:

- [x] workspace abstraction
- [x] runtime integration strategy *(gateway + `runtime-service` + optional provider)*
- [x] tool registry *(first pass)*
- [x] real file tools *(agent tools + runtime actions)*
- [x] stronger verification *(local + optional sandbox build)*

Then:

- [x] skills system *(first pass)*
- [x] live preview runtime *(gateway path)*
- [x] terminal/logs *(polling via gateway)*
- [x] persistence hardening *(optional Redis dashboard sync)*

Then:

- [ ] product polish
- [ ] growth features
- [ ] advanced collaboration/team features

## Concrete Near-Term TODOs

Best next actions *(as of roadmap update)*:

- [ ] split **`lib/agent-tools.ts`** into modules + standardized tool result types
- [ ] SSE or streaming logs for **`/v1/process-logs`** (optional; polling exists today)
- [ ] structured compile/runtime errors → agent loop (beyond sandbox build output)
- [ ] define “production-grade” MVP metrics *(Phase 0)* when SaaS timing firms up

## Open Questions

- [x] should Webmaker support both virtual mode and real sandbox mode during migration? *(**Yes** — virtual/Sandpack default; sandbox optional via gateway env.)*
- [x] should Sandpack remain as primary preview, fallback preview, or be phased down? *(**Hybrid**: Sandpack always available; **live iframe** when sandbox URL exists; user can toggle.)*
- [ ] should each session get one persistent sandbox or should workspaces be recreated more often?
- [x] where should skills live in the repo and runtime? *(**Markdown under `skills/` + `.agents/skills/`** + `/api/skills` loader.)*
- [ ] how much of Hermes’s tool behavior should be replicated versus simplified?
- [x] do we want patch-first editing, write-first editing, or a hybrid model? *(**Hybrid**: full-file create/edit + **`agent.patch`**.)*
- [ ] how much terminal exposure should users get directly?
- [ ] what is the smallest production-grade milestone we can ship without overbuilding?

## Non-Goals

At least initially, Webmaker should not become:

- a generic all-purpose coding agent
- a backend/infrastructure generator
- a clone of Hermes
- a CLI-first product
- a bloated plugin platform before the core workspace is solid

## Working Principles

- keep frontend quality as a core differentiator
- borrow architecture, not baggage
- prefer reliability over flashy but fragile features
- keep the workspace model clear and explicit
- make tool results structured and useful
- use skills to sharpen outcomes, not patch a weak runtime
- move incrementally while keeping the studio usable

## Progress Log

Major milestones *(append newest at bottom)*:

- [x] Created roadmap and transformation plan
- [x] Extracted agent tools into `lib/agent-tools.ts`
- [x] Added first-pass workspace model and helpers
- [x] Added first-pass tool registry module
- [x] Added initial dependency-alignment verification
- [x] Added workspace provider interface with virtual provider
- [x] Added first-pass built-in skills and prompt injection
- [x] Added first-pass studio skill selection UI
- [x] Added Cloudflare sandbox runtime configuration scaffolding
- [x] Added first-pass workspace runtime status UI
- [x] Added first-pass runtime service and `/api/runtime` endpoint
- [x] Moved skill definitions into repo-backed markdown files with API loading
- [x] Added first-pass runtime controls for refresh, preview, installs, and commands
- [x] Added runtime output and error feedback to workspace state
- [x] Fixed an `agent.complete` runtime loop bug during validation
- [x] **Sandbox gateway Worker** (`workers/sandbox-gateway`) + Next.js **`SANDBOX_GATEWAY_*`** client (`sandbox-gateway-client`, `runtime-service`)
- [x] **Runtime actions**: `sync_workspace`, `get_logs`, `verify_build`; **`POST /api/runtime`** extended (**`processId`** for logs)
- [x] **Generation alignment**: `sessionWorkspace` on **`/api/generate`**, merged workspace in **`executeAgentTool`**, post-complete **`sync_workspace`** for sandbox sessions
- [x] **`agent.patch`** + **`agent.verify`** optional sandbox **`npm run build`**; UI activity kind **`patch`**
- [x] **Studio**: Runtime logs/build/sync controls; **Live iframe vs Sandpack** toggle; **Sync to sandbox**; **Sync & Restart Preview** reconnect path
- [x] **Dashboard session persistence** (optional Redis): **`/api/dashboard-session`**, **`useDashboardSessionSync`**
- [x] **Monorepo dev**: **`next.config.ts`** Turbopack root + Tailwind **`resolveAlias`** (run **`npm`** from **`webmaker/`**)
- [x] **`GET /api/health`** and **`DEPLOY.md`** env checklist
- [ ] Modular split of **`agent-tools`** + richer verification/fix loop *(ongoing backlog)*
