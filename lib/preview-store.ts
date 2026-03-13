/**
 * Server-side preview store.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set (e.g. on Vercel);
 * otherwise falls back to /tmp for local dev.
 */

import { Redis } from "@upstash/redis";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const STORE_DIR = join(tmpdir(), "wm-previews");
const PREVIEW_TTL_SEC = 86400; // 24 hours

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/** Unique preview ID: base36 timestamp + short UUID segment */
export function generatePreviewId(): string {
  const ts = Date.now().toString(36);
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${ts}-${uid}`;
}

async function ensureDir() {
  await mkdir(STORE_DIR, { recursive: true });
}

function previewKey(id: string): string {
  return `preview:${id}`;
}

export async function storePreview(id: string, data: unknown): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(previewKey(id), data as object, { ex: PREVIEW_TTL_SEC });
    return;
  }
  await ensureDir();
  await writeFile(join(STORE_DIR, `${id}.json`), JSON.stringify(data), "utf8");
}

export async function retrievePreview(id: string): Promise<unknown | null> {
  if (!id || typeof id !== "string") return null;
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(previewKey(id));
      return raw ?? null;
    } catch {
      return null;
    }
  }
  try {
    const raw = await readFile(join(STORE_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
