import { getBootstrapFiles } from "@/lib/download-bootstrap";
import type { GeneratedProject } from "@/lib/types";

/** Paths fully defined by bootstrap; user project must not override (matches prior Sandpack preview rules). */
const PREVIEW_LOCKED_PATHS = new Set([
  "/package.json",
  "/index.html",
  "/vite.config.js",
  "/vite.config.ts",
  "/tsconfig.json",
  "/tsconfig.node.json",
  "/.gitignore",
  "/README.md",
]);

function toRelativePath(projectPath: string): string {
  return projectPath.replace(/^\//, "");
}

/**
 * Flat file map for `@stackblitz/sdk` `embedProject` (`template: "node"`).
 * Keys are repo-relative paths (no leading slash).
 */
export function getStackBlitzFileMap(project: GeneratedProject): Record<string, string> {
  const bootstrap = getBootstrapFiles(project);
  const files: Record<string, string> = { ...bootstrap };

  for (const [path, file] of Object.entries(project.files)) {
    if (PREVIEW_LOCKED_PATHS.has(path)) {
      continue;
    }
    files[toRelativePath(path)] = file.code;
  }

  return files;
}

export interface StackBlitzEmbedDefinition {
  title: string;
  description: string;
  template: "node";
  files: Record<string, string>;
  /** Primary file to open in the editor (relative path). */
  openFile: string;
}

export function getStackBlitzEmbedDefinition(project: GeneratedProject): StackBlitzEmbedDefinition {
  return {
    title: project.title.slice(0, 120) || "Webmaker project",
    description:
      (project.summary ?? "A frontend app generated with Webmaker.").slice(0, 240),
    template: "node",
    files: getStackBlitzFileMap(project),
    openFile: toRelativePath(project.entry),
  };
}
