/**
 * Canonical tool argument contracts + embedded catalog JSON for the system prompt.
 * Keeps validation, prompt text, and OpenRouter tool shape aligned.
 */

import type { AgentToolCall, AgentToolName } from "@/lib/agent-tools";
import { DEFAULT_VERIFY_CHECKS, normalizeFilePayload } from "@/lib/agent-tools";
import { getToolDefinitions } from "@/lib/tool-registry";

/** JSON Schema-ish parameter blocks per tool (embedded in system prompt). */
const TOOL_PARAMETER_BLOCKS: Record<
  AgentToolName,
  { description: string; parameters: Record<string, unknown> }
> = {
  "agent.plan": {
    description:
      "Break the request into a concrete frontend implementation plan.",
    parameters: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description:
            "Short description of the build goal (optional; a default is used if omitted).",
        },
      },
    },
  },
  "agent.inspect": {
    description: "Inspect the current project tree or a specific set of files.",
    parameters: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Optional absolute project paths to inspect.",
        },
      },
    },
  },
  "agent.search": {
    description: "Search filenames and file contents for a query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to search for across the current project.",
        },
      },
      required: ["query"],
    },
  },
  "agent.read": {
    description:
      "Read specific files for editing context. Pass at most 2–3 paths per call; call again for the next batch.",
    parameters: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Absolute project paths to read (max 2–3 per call).",
        },
      },
      required: ["targets"],
    },
  },
  "agent.create": {
    description:
      "Create new frontend files. Pass at most 2–3 files per call; call again for the next batch.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Short reason for the new files (recommended).",
        },
        files: {
          type: "object",
          description:
            "Map of absolute project paths to full file contents (string or { code }). Arrays of { path, code } are also accepted by the runtime.",
        },
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Optional path list matching the written files.",
        },
      },
      required: ["files"],
    },
  },
  "agent.edit": {
    description:
      "Update one existing frontend file. One file per call; call agent.edit again for each additional file.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Short reason for the edits (recommended).",
        },
        files: {
          type: "object",
          description:
            "Map of one absolute path to full file contents. Arrays of { path, code } are also accepted.",
        },
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Optional path list matching the written file.",
        },
      },
      required: ["files"],
    },
  },
  "agent.patch": {
    description:
      "Apply a targeted search-and-replace to one existing file (first occurrence, or all when replaceAll is true).",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute project path to the file.",
        },
        search: {
          type: "string",
          description: "Exact substring to find (must appear at least once).",
        },
        replace: {
          type: "string",
          description: "Replacement text (may be empty).",
        },
        replaceAll: {
          type: "boolean",
          description: "Replace every occurrence instead of only the first.",
        },
      },
      required: ["path", "search"],
    },
  },
  "agent.rename": {
    description: "Rename a file without changing its contents.",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Existing absolute project path.",
        },
        to: {
          type: "string",
          description: "New absolute project path.",
        },
      },
      required: ["from", "to"],
    },
  },
  "agent.delete": {
    description:
      "Delete one obsolete file. One path per call; call again for each additional file.",
    parameters: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Exactly one absolute project path to remove.",
        },
      },
      required: ["targets"],
    },
  },
  "agent.verify": {
    description:
      "Run local consistency checks before runtime verification (entry exists, imports resolve, dependencies declared).",
    parameters: {
      type: "object",
      properties: {
        checks: {
          type: "array",
          items: { type: "string" },
          description: `Optional named checks. Valid labels (case-insensitive): ${DEFAULT_VERIFY_CHECKS.join(", ")}.`,
        },
      },
    },
  },
  "runtime.sync_workspace": {
    description:
      "Write the current generated project to the active runtime workspace.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  "runtime.install_dependencies": {
    description:
      "Install dependencies in the active runtime workspace. Local runtime uses npm install.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  "runtime.run_command": {
    description:
      "Run a command in the active runtime workspace. Local runtime allows only a fixed npm allowlist.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "For local runtime: npm install, npm run build, npm run dev, npm test, or npm run lint. Cloudflare: passed to sandbox.exec.",
        },
      },
      required: ["command"],
    },
  },
  "runtime.verify_build": {
    description:
      "Run the project production build and return stdout, stderr, and structured errors.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  "runtime.start_preview": {
    description:
      "Start the runtime dev server and return a preview URL.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  "runtime.get_logs": {
    description:
      "Read captured runtime logs for the active preview process or last command.",
    parameters: {
      type: "object",
      properties: {
        processId: {
          type: "string",
          description:
            "Optional process id returned by runtime.start_preview (local preview ids look like {workspaceId}-preview).",
        },
      },
    },
  },
  "agent.complete": {
    description: "Finish the request and commit final project metadata.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Short summary of what was created or updated.",
        },
        title: {
          type: "string",
          description: "Final project title.",
        },
        entry: {
          type: "string",
          description: "Absolute path to the final entry file.",
        },
        dependencies: {
          type: "object",
          description: "Dependency map to merge into the project.",
        },
      },
      required: ["summary"],
    },
  },
};

const KNOWN_VERIFY_CHECKS = new Set(
  DEFAULT_VERIFY_CHECKS.map((c) => c.trim().toLowerCase())
);

function assertNonEmptyString(
  value: unknown,
  field: string,
  tool: AgentToolName
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `${tool}: "${field}" must be a non-empty string.`
    );
  }
}

/**
 * Validate tool name + arguments before workspace/runtime execution.
 * Throws Error with a clear message for the model to repair.
 */
export function validateAgentToolCall(call: AgentToolCall): void {
  const { tool, arguments: args = {} } = call;
  const a = args;

  switch (tool) {
    case "agent.plan":
      return;

    case "agent.inspect":
      return;

    case "agent.search": {
      assertNonEmptyString(a.query, "query", tool);
      return;
    }

    case "agent.read": {
      if (!Array.isArray(a.targets) || a.targets.length === 0) {
        throw new Error(`${tool}: "targets" must be a non-empty array of paths.`);
      }
      for (const t of a.targets) {
        if (typeof t !== "string" || t.trim().length === 0) {
          throw new Error(
            `${tool}: each target must be a non-empty path string.`
          );
        }
      }
      return;
    }

    case "agent.create":
    case "agent.edit": {
      const writes = normalizeFilePayload(a.files);
      if (writes.length === 0) {
        throw new Error(
          `${tool}: "files" must contain at least one file path with content (object map of paths to strings or { code }, or an array of { path, code }).`
        );
      }
      return;
    }

    case "agent.patch": {
      assertNonEmptyString(a.path, "path", tool);
      assertNonEmptyString(a.search, "search", tool);
      return;
    }

    case "agent.rename": {
      assertNonEmptyString(a.from, "from", tool);
      assertNonEmptyString(a.to, "to", tool);
      return;
    }

    case "agent.delete": {
      if (!Array.isArray(a.targets) || a.targets.length === 0) {
        throw new Error(`${tool}: "targets" must be a non-empty array of paths.`);
      }
      for (const t of a.targets) {
        if (typeof t !== "string" || t.trim().length === 0) {
          throw new Error(
            `${tool}: each target must be a non-empty path string.`
          );
        }
      }
      return;
    }

    case "agent.verify": {
      if (a.checks === undefined) return;
      if (!Array.isArray(a.checks)) {
        throw new Error(`${tool}: "checks" must be an array of strings when provided.`);
      }
      for (const c of a.checks) {
        if (typeof c !== "string" || !c.trim()) {
          throw new Error(`${tool}: each check must be a non-empty string.`);
        }
        if (!KNOWN_VERIFY_CHECKS.has(c.trim().toLowerCase())) {
          throw new Error(
            `${tool}: unknown check "${c}". Valid: ${DEFAULT_VERIFY_CHECKS.join(", ")}.`
          );
        }
      }
      return;
    }

    case "runtime.run_command": {
      assertNonEmptyString(a.command, "command", tool);
      return;
    }

    case "runtime.get_logs": {
      if (a.processId !== undefined && typeof a.processId !== "string") {
        throw new Error(`${tool}: "processId" must be a string when provided.`);
      }
      return;
    }

    case "runtime.sync_workspace":
    case "runtime.install_dependencies":
    case "runtime.verify_build":
    case "runtime.start_preview":
      return;

    case "agent.complete": {
      assertNonEmptyString(a.summary, "summary", tool);
      if (a.title !== undefined && typeof a.title !== "string") {
        throw new Error(`${tool}: "title" must be a string when provided.`);
      }
      if (a.entry !== undefined && typeof a.entry !== "string") {
        throw new Error(`${tool}: "entry" must be a string when provided.`);
      }
      if (
        a.dependencies !== undefined &&
        (typeof a.dependencies !== "object" || a.dependencies === null)
      ) {
        throw new Error(`${tool}: "dependencies" must be an object when provided.`);
      }
      return;
    }
  }
}

/** Full catalog JSON string for the system prompt (replaces static Agent Tools.json read). */
export function getAgentToolsCatalogJson(runtimeToolsEnabled = true): string {
  const defs = getToolDefinitions(runtimeToolsEnabled);
  const byName = new Map(defs.map((d) => [d.name, d]));
  const catalog: Record<string, unknown> = {};

  for (const name of Object.keys(TOOL_PARAMETER_BLOCKS) as AgentToolName[]) {
    if (!runtimeToolsEnabled && name.startsWith("runtime.")) {
      continue;
    }
    const block = TOOL_PARAMETER_BLOCKS[name];
    const def = byName.get(name);
    catalog[name] = {
      description: def?.description ?? block.description,
      parameters: block.parameters,
    };
  }

  return JSON.stringify(catalog, null, 2);
}
