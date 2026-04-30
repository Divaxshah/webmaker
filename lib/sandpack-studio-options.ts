import type { SandpackProviderProps } from "@codesandbox/sandpack-react";
import type { GeneratedProject } from "@/lib/types";

/** Provider options shape from Sandpack — keeps bundler UX aligned with Studio + embed routes. */
export type WebmakerSandpackOptions = NonNullable<SandpackProviderProps["options"]>;

/**
 * Studio preview tuning (@codesandbox/sandpack-react 2.x):
 * - initMode immediate: bundler starts without viewport lazy gate (Studio panel is always mounted).
 * - delayed recompile: fewer overlapping compiles when AI streams many file updates.
 * - bundlerTimeOut: default is 40s; cold bundler wake often needs longer.
 * - Service worker: caches transpilers after first load (repeat visits).
 *
 * bundlerURL is omitted so the client uses the version-matched host bundled with @codesandbox/sandpack-client.
 */
export const SANDPACK_BUNDLER_TIMEOUT_MAX_AUTO_RETRIES = 2;

export const WEBMAKER_SANDPACK_OPTIONS: WebmakerSandpackOptions = {
  initMode: "immediate",
  autorun: true,
  autoReload: true,
  recompileMode: "delayed",
  recompileDelay: 450,
  bundlerTimeOut: 90_000,
  experimental_enableServiceWorker: true,
};

/** Stable key segment so Sandpack fully remounts when project contents change (avoids stale bundler sessions). */
export function getSandpackSessionFingerprint(project: GeneratedProject): string {
  const parts: string[] = [project.title, project.entry];
  for (const path of Object.keys(project.files).sort()) {
    const file = project.files[path];
    parts.push(path, file.code);
  }
  return parts.join("\x00");
}

function fnv1a32Hex(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Compact React key for SandpackProvider (hash avoids huge keys on large projects). */
export function getSandpackSessionKey(project: GeneratedProject): string {
  const fp = getSandpackSessionFingerprint(project);
  return `${project.entry}-${fnv1a32Hex(new TextEncoder().encode(fp))}`;
}
