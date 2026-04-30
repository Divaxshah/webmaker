import { describe, expect, it } from "vitest";
import { validateAgentToolCall } from "@/lib/tool-contract";
import { requireProjectPath } from "@/lib/project";

describe("validateAgentToolCall", () => {
  it("accepts agent.search with query", () => {
    expect(() =>
      validateAgentToolCall({
        tool: "agent.search",
        arguments: { query: "foo" },
      })
    ).not.toThrow();
  });

  it("rejects empty query for agent.search", () => {
    expect(() =>
      validateAgentToolCall({
        tool: "agent.search",
        arguments: { query: "   " },
      })
    ).toThrow(/query/);
  });

  it("rejects unknown agent.verify check", () => {
    expect(() =>
      validateAgentToolCall({
        tool: "agent.verify",
        arguments: { checks: ["not a real check"] },
      })
    ).toThrow(/unknown check/i);
  });

  it("requires files for agent.create", () => {
    expect(() =>
      validateAgentToolCall({
        tool: "agent.create",
        arguments: { files: {} },
      })
    ).toThrow(/files/);
  });
});

describe("requireProjectPath", () => {
  it("rejects empty paths", () => {
    expect(() => requireProjectPath("", "x")).toThrow(/non-empty/);
    expect(() => requireProjectPath("   ", "x")).toThrow(/non-empty/);
  });

  it("normalizes relative paths", () => {
    expect(requireProjectPath("src/App.tsx", "p")).toBe("/src/App.tsx");
  });
});
