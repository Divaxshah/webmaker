"use client";

import { useEffect, useEffectEvent } from "react";
import { useActiveCode, useSandpack, useSandpackClient } from "@codesandbox/sandpack-react";
import { normalizeRuntimeError } from "@/lib/runtime-error";
import type { RuntimeErrorState } from "@/lib/types";

interface UseSandpackErrorsProps {
  onRuntimeError: (payload: RuntimeErrorState) => void;
}

const getMessageText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Unknown runtime error";
};

export const useSandpackErrors = ({
  onRuntimeError,
}: UseSandpackErrorsProps): void => {
  const { code } = useActiveCode();
  const { sandpack } = useSandpack();
  const { listen } = useSandpackClient();
  const reportRuntimeError = useEffectEvent((message: string, currentCode: string) => {
    onRuntimeError(
      normalizeRuntimeError({
        message,
        code: currentCode,
      })
    );
  });

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if (message.type === "action" && message.action === "show-error") {
        reportRuntimeError(getMessageText(message.message), code);
      }

      if (message.type === "action" && message.action === "notification") {
        reportRuntimeError(getMessageText(message.title), code);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [code, listen]);

  useEffect(() => {
    if (sandpack.error?.message) {
      reportRuntimeError(sandpack.error.message, code);
    }
  }, [code, sandpack.error?.message]);
};
