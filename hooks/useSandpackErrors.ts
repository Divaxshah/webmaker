"use client";

import { useEffect } from "react";
import { useActiveCode, useSandpack, useSandpackClient } from "@codesandbox/sandpack-react";

interface RuntimeErrorPayload {
  message: string;
  code: string;
}

interface UseSandpackErrorsProps {
  onRuntimeError: (payload: RuntimeErrorPayload) => void;
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

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if (message.type === "action" && message.action === "show-error") {
        onRuntimeError({
          message: getMessageText(message.message),
          code,
        });
      }

      if (message.type === "action" && message.action === "notification") {
        onRuntimeError({
          message: getMessageText(message.title),
          code,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [code, listen, onRuntimeError]);

  useEffect(() => {
    if (sandpack.error?.message) {
      onRuntimeError({
        message: sandpack.error.message,
        code,
      });
    }
  }, [code, onRuntimeError, sandpack.error?.message]);
};
