"use client";

import { useEffect, useRef } from "react";
import { migrateLegacySession } from "@/lib/project";
import {
  getAppliedServerTimestamp,
  getOrCreateDeviceId,
  setAppliedServerTimestamp,
} from "@/lib/device-id";
import type { DashboardPersistPayload } from "@/lib/dashboard-session-store";
import type { LuminoModelId } from "@/lib/models";
import type { Session } from "@/lib/types";
import { createWorkspaceSnapshot, DEFAULT_ACTIVE_SKILL_IDS, syncProjectToWorkspace } from "@/lib/workspace";
import { useAppStore } from "@/lib/store";

const DEBOUNCE_MS = 2500;

const hydrateSession = (session: Session): Session => {
  const migrated = migrateLegacySession(session as Session & { currentCode?: unknown });
  return {
    ...migrated,
    workspace: syncProjectToWorkspace(
      migrated.workspace ?? createWorkspaceSnapshot(migrated.currentProject),
      migrated.currentProject
    ),
    activeSkillIds: migrated.activeSkillIds ?? [...DEFAULT_ACTIVE_SKILL_IDS],
  };
};

/**
 * When Upstash Redis is configured, loads dashboard state from the server on mount
 * (if newer than last applied) and debounces saves back to Redis.
 */
export function useDashboardSessionSync(enabled = true) {
  const hydrateDone = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After Redis returns 503 (misconfigured host, ENOTFOUND, etc.), skip PUT spam. */
  const redisSyncDisabledRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const deviceId = getOrCreateDeviceId();
      if (!deviceId) {
        hydrateDone.current = true;
        return;
      }

      try {
        const res = await fetch(
          `/api/dashboard-session?deviceId=${encodeURIComponent(deviceId)}`,
          { cache: "no-store" }
        );

        if (res.status === 503 || res.status === 502 || res.status === 404 || cancelled) {
          if (res.status === 503 || res.status === 502) {
            redisSyncDisabledRef.current = true;
          }
          hydrateDone.current = true;
          return;
        }

        if (!res.ok) {
          hydrateDone.current = true;
          return;
        }

        const data = (await res.json()) as {
          updatedAt: string;
          payload: DashboardPersistPayload;
        };

        const applied = getAppliedServerTimestamp();
        if (applied && data.updatedAt <= applied) {
          hydrateDone.current = true;
          return;
        }

        const payload = data.payload;
        const sessions = payload.sessions.map((s) => hydrateSession(s));

        useAppStore.setState({
          sessions,
          activeSessionId: payload.activeSessionId,
          lastPrompt: payload.lastPrompt,
          selectedModelId: payload.selectedModelId as LuminoModelId,
        });
        setAppliedServerTimestamp(data.updatedAt);
      } catch {
        /* offline or missing Redis */
      } finally {
        hydrateDone.current = true;
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const push = () => {
      if (!hydrateDone.current || redisSyncDisabledRef.current) {
        return;
      }

      const deviceId = getOrCreateDeviceId();
      if (!deviceId) {
        return;
      }

      const state = useAppStore.getState();
      const payload: DashboardPersistPayload = {
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        lastPrompt: state.lastPrompt,
        selectedModelId: state.selectedModelId,
      };

      void (async () => {
        try {
          const res = await fetch("/api/dashboard-session", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, payload }),
          });

          if (!res.ok) {
            if (res.status === 503 || res.status === 502) {
              redisSyncDisabledRef.current = true;
            }
            return;
          }

          const json = (await res.json()) as { updatedAt?: string };
          if (json.updatedAt) {
            setAppliedServerTimestamp(json.updatedAt);
          }
        } catch {
          /* ignore */
        }
      })();
    };

    const unsub = useAppStore.subscribe(() => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        push();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [enabled]);
}
