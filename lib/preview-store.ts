/**
 * Server-side preview store.
 * Keeps an in-memory LRU-style map + writes to /tmp so previews
 * survive across hot-reloads and are accessible from any browser via the share URL.
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const STORE_DIR = join(tmpdir(), "wm-previews");

/** Unique preview ID: microsecond-timestamp + UUID4 segment */
export function generatePreviewId(): string {
  const ts = Date.now().toString(36); // base-36 timestamp
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 16); // 16 hex chars
  return `${ts}-${uid}`;
}

async function ensureDir() {
  await mkdir(STORE_DIR, { recursive: true });
}

export async function storePreview(id: string, data: unknown): Promise<void> {
  await ensureDir();
  await writeFile(join(STORE_DIR, `${id}.json`), JSON.stringify(data), "utf8");
}

export async function retrievePreview(id: string): Promise<unknown | null> {
  try {
    const raw = await readFile(join(STORE_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
