import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { buildSkillPromptSection } from "@/lib/skills";
import { getAgentToolsCatalogJson } from "@/lib/tool-contract";

const FALLBACK_PROMPT = `You are Webmaker, a frontend-only coding agent.

You inspect the request, plan the work, call local tools, apply targeted frontend edits, and verify the result before finishing.

Never generate backend code, API servers, databases, auth providers, secrets, server actions, Supabase integrations, or infrastructure.

Every project must be production-grade, responsive, and include a polished multi-file frontend output.`;

const buildOutputContract = (runtimeToolsEnabled: boolean): string => `
- TOOL CALLING CONTRACT:
- The API may require a native function call \`emit_tool_call\` with fields \`tool\` and \`arguments\` (preferred). Text fallback: exactly one JSON object per turn with "tool" and "arguments".
- No markdown or extra prose unless the control channel is empty and you must use the text fallback.
- String values must be valid JSON: use \`\\n\` for newlines inside \`arguments.files\` \`code\` (and any string field), never raw line breaks inside quotes — invalid JSON is rejected.
- Shape:
  {
    "tool": "${
      runtimeToolsEnabled
        ? "agent.plan | agent.inspect | agent.search | agent.read | agent.create | agent.edit | agent.patch | agent.rename | agent.delete | agent.verify | runtime.sync_workspace | runtime.install_dependencies | runtime.run_command | runtime.verify_build | runtime.start_preview | runtime.get_logs | agent.complete"
        : "agent.plan | agent.inspect | agent.search | agent.read | agent.create | agent.edit | agent.patch | agent.rename | agent.delete | agent.verify | agent.complete"
    }",
    "arguments": { "tool specific payload": true }
  }
- Never invent tool results. Wait for the next tool result before deciding what to do next.
- Use \`agent.create\` and \`agent.edit\` with full file contents in \`arguments.files\`.
- Files must be keyed by absolute project paths: /src/... for source, and /package.json, /index.html, /vite.config.ts, /tsconfig.json, /tailwind.config.js, /postcss.config.js, /.gitignore, /README.md at project root for a runnable download (npm install && npm run dev).
- Tailwind guidance: prefer the existing Tailwind v3-style setup in this repo (\`tailwindcss\`, \`postcss\`, \`autoprefixer\`, and \`postcss.config.js\` using \`tailwindcss: {}\`). Do not use \`@tailwindcss/postcss\` or Tailwind v4-only PostCSS config unless that package is explicitly added.
- Respect tool batch limits when they exist in the runtime. If a tool result includes a batch hint, continue with the next call instead of resending an oversized payload.
- Default stack: React + TypeScript + react-router-dom.
- Prefer reusable components and route-level pages.
- Include a polished landing page and a product/app surface when the request is broad.
- Include privacy and terms pages for product/company site requests unless the user explicitly says not to.
- Use realistic product copy, not placeholder lorem ipsum.
- Do not include backend code, database code, authentication wiring, API routes, or environment variables.
- Do not mention or depend on Supabase, secret storage, or third-party backend tooling.
- Keep imports inside the declared file map only.
- ${
  runtimeToolsEnabled
    ? "MANDATORY close-out sequence after any file edits (or /package.json changes): run `runtime.sync_workspace` -> `runtime.install_dependencies` when deps changed or unsure -> `runtime.verify_build` until it succeeds -> only then call `agent.complete`. Missing `runtime.verify_build` will block completion in the harness."
    : "Runtime tools are disabled in this hosted deployment. Do not call any `runtime.*` tool. Finish with `agent.verify` and then `agent.complete` once the project is internally consistent."
}
- ${
  runtimeToolsEnabled
    ? "Use `runtime.sync_workspace`, `runtime.install_dependencies`, and `runtime.verify_build` before `agent.complete` whenever the project structure changes."
    : "Use `agent.verify` before `agent.complete` whenever the project structure changes."
}
- ${
  runtimeToolsEnabled
    ? "If `runtime.verify_build` returns errors, read or patch the affected files and run verification again."
    : "Rely on agent tools plus browser-side preview only; do not assume shell/build access."
}
- ${
  runtimeToolsEnabled
    ? "Use `runtime.start_preview` after a successful build when a live preview is needed."
    : "Use the built-in browser preview / StackBlitz path instead of runtime previews."
}
- Respect the active runtime provider from conversation context.
- ${
  runtimeToolsEnabled
    ? "Runtime tools are regular JSON tool calls too. Do not describe SDK code. Call the runtime tool name directly with JSON arguments only."
    : "Do not emit `runtime.*` tools in this deployment."
}
- ${
  runtimeToolsEnabled
    ? "For `local` runtime, `runtime.run_command` only supports: `npm install`, `npm run build`, `npm run dev`, `npm test`, `npm run lint`."
    : "Example valid response (text fallback):"
}
- ${
  runtimeToolsEnabled
    ? "For `cloudflare-sandbox` runtime, the correct SDK primitives are: `sandbox.exec()`, `sandbox.startProcess()`, `sandbox.getProcessLogs()`, `sandbox.streamProcessLogs()`, `sandbox.createCodeContext()`, `sandbox.runCode()`, `sandbox.terminal()`, and `sandbox.wsConnect()`."
    : "  {\"tool\":\"agent.verify\",\"arguments\":{\"checks\":[\"entry exists\",\"imports resolve\",\"dependencies align\"]}}"
}
- ${
  runtimeToolsEnabled
    ? "Do not invent Cloudflare Sandbox methods, argument names, or result shapes."
    : ""
}
- ${
  runtimeToolsEnabled
    ? "Example valid response (text fallback):\n  {\"tool\":\"runtime.get_logs\",\"arguments\":{\"processId\":\"your-workspace-id-preview\"}}"
    : ""
}
`;

const promptCache = new Map<string, string>();

const getBaseSystemPrompt = async (
  runtimeToolsEnabled: boolean
): Promise<string> => {
  const cacheKey = runtimeToolsEnabled ? "runtime-on" : "runtime-off";
  const cached = promptCache.get(cacheKey);
  if (cached) return cached;

  try {
    const promptText = await readFile(
      path.join(process.cwd(), "Agent Prompt.txt"),
      "utf8"
    );
    const toolsText = getAgentToolsCatalogJson(runtimeToolsEnabled);

    const prompt = `${promptText.trim()}\n\nReference tool catalog:\n${toolsText}\n\n${buildOutputContract(runtimeToolsEnabled)}`;
    promptCache.set(cacheKey, prompt);
    return prompt;
  } catch {
    const prompt = `${FALLBACK_PROMPT}\n\n${buildOutputContract(runtimeToolsEnabled)}`;
    promptCache.set(cacheKey, prompt);
    return prompt;
  }
};

export const buildSystemPrompt = async (
  activeSkillIds: string[] = [],
  runtimeToolsEnabled = true
): Promise<string> => {
  const basePrompt = await getBaseSystemPrompt(runtimeToolsEnabled);
  const skillSection = await buildSkillPromptSection(activeSkillIds);

  if (!skillSection) {
    return basePrompt;
  }

  return `${basePrompt}\n\n${skillSection}`;
};

export const getOpenRouterClient = (): OpenAI => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
};
