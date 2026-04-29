import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { GeneratedProject } from "./types"
import JSZip from "jszip"
import { getBootstrapFiles } from "./download-bootstrap"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

export function createId() {
  return Math.random().toString(36).substring(2, 9)
}

export function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4)
}

export const STARTER_PROJECT: GeneratedProject = {
  title: "New Workspace",
  summary: "Start prompting to generate a frontend project.",
  framework: "react-ts",
  entry: "/src/main.tsx",
  dependencies: {
    react: "^18.0.0",
    "react-dom": "^18.0.0",
    "lucide-react": "latest",
    clsx: "latest",
    "tailwind-merge": "latest",
  },
  files: {
    "/src/main.tsx": {
      code: "import React from \"react\";\nimport ReactDOM from \"react-dom/client\";\nimport App from \"./App\";\nimport \"./styles.css\";\n\nReactDOM.createRoot(document.getElementById(\"root\")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);",
    },
    "/src/App.tsx": {
      code: "export default function App() {\n  return (\n    <div className=\"flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-zinc-50\">\n      <div className=\"space-y-4 text-center\">\n        <h1 className=\"text-3xl font-bold tracking-tight\">Ready to build</h1>\n        <p className=\"max-w-sm text-zinc-400\">\n          Enter a prompt in the chat to generate a new multi-file application.\n        </p>\n      </div>\n    </div>\n  );\n}",
      active: true,
    },
    "/src/styles.css": {
      code: "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  color-scheme: dark;\n}\n\nbody {\n  margin: 0;\n  font-family: \"Manrope\", sans-serif;\n}",
    },
  },
};

export async function downloadProjectBundle(project: GeneratedProject) {
  const zip = new JSZip();

  // Bootstrap: runnable project config (package.json, index.html, vite/tailwind, README). When the agent
  // creates these root files, they are in project.files and overwrite these defaults when we add files below.
  const bootstrap = getBootstrapFiles(project);
  for (const [path, content] of Object.entries(bootstrap)) {
    zip.file(path, content);
  }

  for (const [path, file] of Object.entries(project.files)) {
    const cleanPath = path.replace(/^\//, "");
    zip.file(cleanPath, file.code);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.title.toLowerCase().replace(/\s+/g, "-") || "webmaker-project"}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function openProjectInStackBlitz(project: GeneratedProject) {
  console.log("Opening in StackBlitz...", project);
}
