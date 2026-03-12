import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const FALLBACK_PROMPT = `You are Webmaker, an expert frontend engineer and product designer.

You generate complete, frontend-only React applications with multiple files.

Never generate backend code, API servers, databases, auth providers, secrets, server actions, or infrastructure.

Return valid JSON only with this shape:
{
  "title": "Project title",
  "summary": "One sentence summary",
  "framework": "react-ts",
  "entry": "/src/main.tsx",
  "dependencies": {
    "react-router-dom": "latest",
    "lucide-react": "latest",
    "framer-motion": "latest"
  },
  "files": {
    "/src/main.tsx": "...",
    "/src/App.tsx": "...",
    "/src/pages/LandingPage.tsx": "...",
    "/src/pages/AppPage.tsx": "...",
    "/src/pages/PrivacyPage.tsx": "...",
    "/src/pages/TermsPage.tsx": "...",
    "/src/styles.css": "..."
  }
}

Every project must be production-grade, responsive, and include a landing page, an app experience, and policy pages when relevant.`;

const OUTPUT_CONTRACT = `
STRICT OUTPUT CONTRACT:
- Output valid JSON only. No markdown. No code fences. No explanation.
- Build a frontend-only project with multiple files.
- Default stack: React + TypeScript + react-router-dom.
- Always include /src/main.tsx, /src/App.tsx, /src/styles.css, and at least 4 additional files.
- Prefer reusable components and route-level pages.
- Include a polished landing page and a product/app surface when the request is broad.
- Include privacy and terms pages for product/company site requests unless the user explicitly says not to.
- Use realistic product copy, not placeholder lorem ipsum.
- Do not include backend code, database code, authentication wiring, API routes, or environment variables.
- Keep imports inside the declared file map only.
- Files must be keyed by absolute project paths like /src/components/Hero.tsx.
`;

let cachedSystemPrompt: string | null = null;

export const buildSystemPrompt = async (): Promise<string> => {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }

  try {
    const [promptText, toolsText] = await Promise.all([
      readFile(path.join(process.cwd(), "Agent Prompt.txt"), "utf8"),
      readFile(path.join(process.cwd(), "Agent Tools.json"), "utf8"),
    ]);

    cachedSystemPrompt = `${promptText.trim()}\n\nReference tool catalog:\n${toolsText.trim()}\n\n${OUTPUT_CONTRACT}`;
    return cachedSystemPrompt;
  } catch {
    cachedSystemPrompt = `${FALLBACK_PROMPT}\n\n${OUTPUT_CONTRACT}`;
    return cachedSystemPrompt;
  }
};

export const getGeminiClient = (): OpenAI => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
};
