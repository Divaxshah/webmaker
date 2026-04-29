import type { SkillReference } from "@/lib/types";

const FALLBACK_SKILLS: Array<SkillReference & { instruction: string }> = [
  {
    id: "frontend-design",
    title: "Frontend Design",
    category: "design",
    summary:
      "Pushes the agent toward stronger layout, typography, color, and motion decisions.",
    source: "builtin",
    tags: ["design", "ui", "brand"],
    instruction: `
Use a strong visual point of view.
- Choose a distinct aesthetic direction before editing files.
- Avoid generic layouts, timid palettes, and default-feeling typography.
- Prefer expressive typography, intentional composition, and meaningful motion.
`.trim(),
  },
  {
    id: "responsive-hardening",
    title: "Responsive Hardening",
    category: "quality",
    summary:
      "Guides the agent toward more resilient mobile, tablet, and desktop layouts.",
    source: "builtin",
    tags: ["responsive", "mobile", "layout"],
    instruction: `
Prioritize responsive resilience.
- Ensure layouts work cleanly on mobile, tablet, and desktop.
- Avoid overflow traps, cramped spacing, and brittle fixed-width sections.
- Prefer flexible grids, adaptive spacing, and safe text wrapping.
`.trim(),
  },
  {
    id: "runtime-error-fixer",
    title: "Runtime Error Fixer",
    category: "debugging",
    summary:
      "Focuses the agent on repairing import, compile, and runtime issues.",
    source: "builtin",
    tags: ["debugging", "runtime", "repair"],
    instruction: `
Focus on dependable repair.
- Read tool errors carefully before editing.
- Fix root causes, not surface symptoms.
- Verify imports, dependencies, and entry wiring before completion.
`.trim(),
  },
];

const cloneSkillReference = (
  skill: SkillReference & { instruction?: string }
): SkillReference => ({
  id: skill.id,
  title: skill.title,
  category: skill.category,
  summary: skill.summary,
  source: skill.source,
  tags: skill.tags ? [...skill.tags] : undefined,
});

const buildPromptSectionFromRecords = (
  records: Array<SkillReference & { instruction: string }>,
  skillIds: string[]
): string => {
  const resolved = skillIds
    .map((skillId) => records.find((skill) => skill.id === skillId))
    .filter((value): value is SkillReference & { instruction: string } => Boolean(value))
    .map((skill) => `Skill: ${skill.title}\n${skill.instruction}`);

  if (resolved.length === 0) {
    return "";
  }

  return `Active skills:\n\n${resolved.join("\n\n")}`;
};

export const getBuiltinSkills = (): SkillReference[] =>
  FALLBACK_SKILLS.map(cloneSkillReference);

export const getSkillById = (skillId: string): SkillReference | undefined =>
  getBuiltinSkills().find((skill) => skill.id === skillId);

export const getSkillInstruction = (skillId: string): string | null =>
  FALLBACK_SKILLS.find((skill) => skill.id === skillId)?.instruction ?? null;

export const listAvailableSkills = async (): Promise<SkillReference[]> => {
  if (typeof window !== "undefined") {
    return getBuiltinSkills();
  }

  try {
    const { loadSkillFileRecords } = await import("@/lib/skill-files");
    const fileSkills = await loadSkillFileRecords();

    if (fileSkills.length > 0) {
      return fileSkills.map((record) => cloneSkillReference(record.skill));
    }
  } catch {
    // Fall back to built-in metadata when file loading is unavailable.
  }

  return getBuiltinSkills();
};

export const buildSkillPromptSection = async (
  skillIds: string[]
): Promise<string> => {
  if (skillIds.length === 0) {
    return "";
  }

  if (typeof window !== "undefined") {
    return buildPromptSectionFromRecords(FALLBACK_SKILLS, skillIds);
  }

  try {
    const { loadSkillFileRecords } = await import("@/lib/skill-files");
    const fileSkills = await loadSkillFileRecords();

    if (fileSkills.length > 0) {
      return buildPromptSectionFromRecords(
        fileSkills.map((record) => ({
          ...record.skill,
          instruction: record.instruction,
        })),
        skillIds
      );
    }
  } catch {
    // Fall back to built-in instructions when file loading is unavailable.
  }

  return buildPromptSectionFromRecords(FALLBACK_SKILLS, skillIds);
};
