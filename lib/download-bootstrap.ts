import type { GeneratedProject } from "./types";

const BASE_DEPS: Record<string, string> = {
  react: "^18.2.0",
  "react-dom": "^18.2.0",
};

const DEV_DEPS: Record<string, string> = {
  "@types/react": "^19.0.8",
  "@types/react-dom": "^19.0.3",
  "@vitejs/plugin-react": "^4.3.4",
  autoprefixer: "10.4.20",
  "esbuild-wasm": "^0.17.12",
  postcss: "8.4.49",
  tailwindcss: "3.4.15",
  typescript: "^4.9.5",
  vite: "4.2.0",
};

interface BootstrapPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Returns the set of config/setup files required to run a downloaded project
 * locally (npm install && npm run dev) or build for deploy.
 */
export function getBootstrapFiles(project: GeneratedProject): Record<string, string> {
  const name = project.title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "") || "webmaker-project";

  const dependencies = {
    ...BASE_DEPS,
    ...project.dependencies,
  };

  const packageJson = JSON.stringify(
    {
      name,
      private: true,
      version: "0.0.1",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: Object.fromEntries(
        Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))
      ),
      devDependencies: DEV_DEPS,
    },
    null,
    2
  );

  const entryPath = project.entry.replace(/^\//, "");

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(project.title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entryPath}"></script>
  </body>
</html>
`;

  const viteConfigJs = `import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
`;

  const tsconfigJson = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ["src"],
    },
    null,
    2
  );

  const tailwindConfigJs = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;

  const postcssConfigJs = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  const gitignore = `# Dependencies
node_modules/

# Build
dist/
*.local

# Logs
*.log
npm-debug.log*

# Editor
.vscode/*
!.vscode/extensions.json

# OS
.DS_Store
Thumbs.db
`;

  const readme = `# ${escapeHtml(project.title)}

${project.summary || "A frontend application generated with Webmaker."}

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for production

\`\`\`bash
npm run build
npm run preview
\`\`\`

The built site is in \`dist/\`. Deploy that folder to any static host (Vercel, Netlify, GitHub Pages, etc.).
`;

  return {
    "package.json": packageJson,
    "index.html": indexHtml,
    "vite.config.js": viteConfigJs,
    "tsconfig.json": tsconfigJson,
    "tailwind.config.js": tailwindConfigJs,
    "postcss.config.js": postcssConfigJs,
    ".gitignore": gitignore,
    "README.md": readme,
  };
}

export function getPreviewSandpackConfig(project: GeneratedProject): {
  files: Record<string, { code: string; hidden?: boolean; active?: boolean }>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  entry: string;
} {
  const bootstrap = getBootstrapFiles(project);
  const pkg = JSON.parse(bootstrap["package.json"] ?? "{}") as BootstrapPackageJson;
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
  const PREVIEW_OMIT_BOOTSTRAP_PATHS = new Set(["package.json", "vite.config.js"]);

  const files: Record<string, { code: string; hidden?: boolean; active?: boolean }> =
    Object.fromEntries(
      Object.entries(bootstrap)
        .filter(
          ([path]) =>
            path !== ".gitignore" &&
            path !== "README.md" &&
            !PREVIEW_OMIT_BOOTSTRAP_PATHS.has(path)
        )
        .map(([path, code]) => [`/${path.replace(/^\//, "")}`, { code, hidden: true }])
    );

  for (const [path, file] of Object.entries(project.files)) {
    if (PREVIEW_LOCKED_PATHS.has(path)) {
      continue;
    }

    files[path] = {
      code: file.code,
      ...(file.hidden ? { hidden: true } : {}),
      ...(file.active ? { active: true } : {}),
    };
  }

  return {
    files,
    dependencies: {
      ...(pkg.dependencies ?? {}),
    },
    devDependencies: {
      ...(pkg.devDependencies ?? {}),
    },
    entry: project.entry,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
