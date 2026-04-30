import type { AgentToolName } from "@/lib/agent-tools";

export type WebmakerCapabilityName = AgentToolName;

export interface WebmakerToolDefinition {
  name: WebmakerCapabilityName;
  title: string;
  description: string;
  mutatesWorkspace: boolean;
  requiresVerificationAfterRun: boolean;
}

const TOOL_DEFINITIONS: WebmakerToolDefinition[] = [
  {
    name: "agent.plan",
    title: "Plan",
    description: "Break the request into a concrete frontend implementation plan.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "agent.inspect",
    title: "Inspect Workspace",
    description: "Inspect the current project tree or a specific set of files.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "agent.search",
    title: "Search Files",
    description: "Search filenames and file contents for a query.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "agent.read",
    title: "Read File",
    description: "Read specific files for editing context.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "agent.create",
    title: "Create Files",
    description: "Create new frontend files in the current workspace.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: true,
  },
  {
    name: "agent.edit",
    title: "Edit File",
    description: "Update an existing frontend file with full file contents.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: true,
  },
  {
    name: "agent.patch",
    title: "Patch File",
    description:
      "Apply a targeted search-and-replace edit to one existing file without rewriting the whole file.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: true,
  },
  {
    name: "agent.rename",
    title: "Rename File",
    description: "Rename a file without changing its contents.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: true,
  },
  {
    name: "agent.delete",
    title: "Delete File",
    description: "Delete obsolete files from the current workspace.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: true,
  },
  {
    name: "agent.verify",
    title: "Verify Project",
    description: "Run consistency checks before completion.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "runtime.run_command",
    title: "Run Command",
    description:
      "Run an allowed command in the active runtime workspace.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "runtime.sync_workspace",
    title: "Sync Workspace",
    description:
      "Write the in-memory project to the active runtime disk workspace before installs or builds.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: false,
  },
  {
    name: "runtime.install_dependencies",
    title: "Install Dependencies",
    description:
      "Install project dependencies in the active runtime workspace.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: true,
  },
  {
    name: "runtime.verify_build",
    title: "Verify Build",
    description:
      "Run the production build in the runtime workspace; required evidence before agent.complete.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "runtime.start_preview",
    title: "Start Preview",
    description:
      "Start the runtime dev server and expose a preview URL.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "runtime.get_logs",
    title: "Get Logs",
    description:
      "Read captured output from the active runtime process or last command.",
    mutatesWorkspace: false,
    requiresVerificationAfterRun: false,
  },
  {
    name: "agent.complete",
    title: "Complete",
    description: "Commit final metadata and finish the generation cycle.",
    mutatesWorkspace: true,
    requiresVerificationAfterRun: false,
  },
];

export const getToolDefinitions = (
  runtimeToolsEnabled = true
): WebmakerToolDefinition[] =>
  TOOL_DEFINITIONS
    .filter(
      (tool) => runtimeToolsEnabled || !tool.name.startsWith("runtime.")
    )
    .map((tool) => ({ ...tool }));

export const getToolDefinition = (
  name: WebmakerCapabilityName
): WebmakerToolDefinition | undefined =>
  TOOL_DEFINITIONS.find((tool) => tool.name === name);

export const getToolNames = (runtimeToolsEnabled = true): AgentToolName[] =>
  getToolDefinitions(runtimeToolsEnabled)
    .map((tool) => tool.name)
    .filter(
      (toolName): toolName is AgentToolName =>
        toolName.startsWith("agent.") || toolName.startsWith("runtime.")
    );

export const getRuntimeCapabilityNames = (runtimeToolsEnabled = true): string[] =>
  getToolDefinitions(runtimeToolsEnabled)
    .map((tool) => tool.name)
    .filter((toolName) => toolName.startsWith("runtime."));
