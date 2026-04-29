import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SkillReference } from "@/lib/types";

interface SkillFileRecord {
  skill: SkillReference;
  instruction: string;
}

const SKILLS_DIRECTORY = path.join(process.cwd(), "skills");

const parseFrontmatter = (
  contents: string
): { frontmatter: Record<string, string>; body: string } => {
  const trimmed = contents.trim();
  if (!trimmed.startsWith("---")) {
    return {
      frontmatter: {},
      body: trimmed,
    };
  }

  const match = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {},
      body: trimmed,
    };
  }

  const [, rawFrontmatter, body] = match;
  const frontmatter = rawFrontmatter
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});

  return {
    frontmatter,
    body: body.trim(),
  };
};

const normalizeSkillFile = (
  fileName: string,
  contents: string
): SkillFileRecord | null => {
  const { frontmatter, body } = parseFrontmatter(contents);
  const id = frontmatter.id?.trim() || fileName.replace(/\.md$/i, "");
  const title = frontmatter.title?.trim() || id;
  const category = frontmatter.category?.trim() || "general";
  const summary = frontmatter.summary?.trim() || "Skill instruction pack.";
  const tags = (frontmatter.tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!body) {
    return null;
  }

  return {
    skill: {
      id,
      title,
      category,
      summary,
      source: "builtin",
      tags,
    },
    instruction: body,
  };
};

export const loadSkillFileRecords = async (): Promise<SkillFileRecord[]> => {
  const entries = await readdir(SKILLS_DIRECTORY, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const files = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const contents = await readFile(path.join(SKILLS_DIRECTORY, fileName), "utf8");
      return normalizeSkillFile(fileName, contents);
    })
  );

  return files.filter((value): value is SkillFileRecord => Boolean(value));
};
