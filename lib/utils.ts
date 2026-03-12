import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { GeneratedProject } from "./types"
import JSZip from "jszip"

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
  entry: "App.tsx",
  dependencies: {
    react: "^18.0.0",
    "react-dom": "^18.0.0",
    "lucide-react": "latest",
    clsx: "latest",
    "tailwind-merge": "latest"
  },
  files: {
    "App.tsx": {
      code: "export default function App() {\n  return (\n    <div className=\"flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-zinc-50\">\n      <div className=\"text-center space-y-4\">\n        <h1 className=\"text-3xl font-bold tracking-tight\">Ready to build</h1>\n        <p className=\"text-zinc-400 max-w-sm\">\n          Enter a prompt in the chat to generate a new multi-file application.\n        </p>\n      </div>\n    </div>\n  );\n}",
    },
    "index.tsx": {
      code: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\nimport App from './App';\n\nconst root = createRoot(document.getElementById('root')!);\nroot.render(<App />);"
    },
    "styles.css": {
      code: "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
    }
  }
}

export async function downloadProjectBundle(project: GeneratedProject) {
  const zip = new JSZip();
  
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
