import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { buildSkillPromptSection } from "@/lib/skills";

const FALLBACK_PROMPT = `You are Webmaker, a frontend-only coding agent.

You inspect the request, plan the work, call local tools, apply targeted frontend edits, and verify the result before finishing.

Never generate backend code, API servers, databases, auth providers, secrets, server actions, Supabase integrations, or infrastructure.

Every project must be production-grade, responsive, and include a polished multi-file frontend output.`;

const OUTPUT_CONTRACT = `
- TOOL CALLING CONTRACT:
- Respond with exactly one JSON object per turn.
- No markdown. No code fences. No extra prose.
- Shape:
  {
    "tool": "agent.plan | agent.inspect | agent.search | agent.read | agent.create | agent.edit | agent.patch | agent.rename | agent.delete | agent.verify | runtime.sync_workspace | runtime.install_dependencies | runtime.run_command | runtime.verify_build | runtime.start_preview | runtime.get_logs | agent.complete",
    "arguments": { "tool specific payload": true }
  }
- Never invent tool results. Wait for the next tool result before deciding what to do next.
- Use \`agent.create\` and \`agent.edit\` with full file contents in \`arguments.files\`.
- Files must be keyed by absolute project paths: /src/... for source, and /package.json, /index.html, /vite.config.js, /tsconfig.json, /tailwind.config.js, /postcss.config.js, /.gitignore, /README.md at project root for a runnable download (npm install && npm run dev).
- Create as many files as needed. There is no file-count limit.
- Default stack: React + TypeScript + react-router-dom.
- Prefer reusable components and route-level pages.
- Include a polished landing page and a product/app surface when the request is broad.
- Include privacy and terms pages for product/company site requests unless the user explicitly says not to.
- Use realistic product copy, not placeholder lorem ipsum.
- Do not include backend code, database code, authentication wiring, API routes, or environment variables.
- Do not mention or depend on Supabase, secret storage, or third-party backend tooling.
- Keep imports inside the declared file map only.
- Use \`runtime.sync_workspace\`, \`runtime.install_dependencies\`, and \`runtime.verify_build\` before \`agent.complete\` whenever the project structure changes.
- If \`runtime.verify_build\` returns errors, read or patch the affected files and run verification again.
- Use \`runtime.start_preview\` after a successful build when a live preview is needed.
- Respect the active runtime provider from conversation context.
- For \`local\` runtime, \`runtime.run_command\` only supports: \`npm install\`, \`npm run build\`, \`npm run dev\`, \`npm test\`, \`npm run lint\`.
- For \`cloudflare-sandbox\` runtime, the correct SDK primitives are: \`sandbox.exec()\`, \`sandbox.startProcess()\`, \`sandbox.getProcessLogs()\`, \`sandbox.streamProcessLogs()\`, \`sandbox.createCodeContext()\`, \`sandbox.runCode()\`, \`sandbox.terminal()\`, and \`sandbox.wsConnect()\`.
- Do not invent Cloudflare Sandbox methods, argument names, or result shapes.
`;

let cachedSystemPrompt: string | null = null;

const getBaseSystemPrompt = async (): Promise<string> => {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  try {
    const [promptText, toolsText] = await Promise.all([
      readFile(path.join(process.cwd(), "Agent Prompt.txt"), "utf8"),
      readFile(path.join(process.cwd(), "Agent Tools.json"), "utf8"),
    ]);

    cachedSystemPrompt = `${promptText.trim()}\n\nReference tool catalog:\n${toolsText.trim()}\n\n${OUTPUT_CONTRACT}`;
  } catch {
    cachedSystemPrompt = `${FALLBACK_PROMPT}\n\n${OUTPUT_CONTRACT}`;
  }

  return cachedSystemPrompt;
};

export const buildSystemPrompt = async (
  activeSkillIds: string[] = []
): Promise<string> => {
  const basePrompt = await getBaseSystemPrompt();
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
