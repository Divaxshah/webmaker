"use client";

import { useEffect, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

interface SandpackTimeoutRecoveryProps {
  /** When the bundler hits internal timeout, remount the provider (same as toolbar Refresh). Capped per project fingerprint in parent. */
  onBundlerTimeout: () => void;
}

/**
 * Sandpack sets status to "timeout" when the iframe does not ready within bundlerTimeOut.
 * One incremental remount often clears a wedged session; we delegate rate-limiting to the parent.
 */
export function SandpackTimeoutRecovery({ onBundlerTimeout }: SandpackTimeoutRecoveryProps) {
  const { sandpack } = useSandpack();
  const prevStatus = useRef(sandpack.status);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = sandpack.status;
    if (prev !== "timeout" && sandpack.status === "timeout") {
      onBundlerTimeout();
    }
  }, [sandpack.status, onBundlerTimeout]);

  return null;
}
