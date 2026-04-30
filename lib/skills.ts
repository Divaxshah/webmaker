import "server-only";

import { loadSkillFileRecords } from "@/lib/skill-files";
import type { SkillReference } from "@/lib/types";

/** Offline fallback only; primary Markdown lives in repo folder skills/ (mirror .agents/skills). */
const FALLBACK_SKILLS: Array<SkillReference & { instruction: string }> = [
  {
    id: "frontend-design",
    title: "Frontend Design",
    category: "design",
    summary:
      "Distinctive, production-grade interfaces; bold aesthetic direction; typography, color, motion, composition - never generic AI polish.",
    source: "builtin",
    tags: ["design", "ui", "frontend", "aesthetics"],
    instruction:
      "Follow the full Frontend Design skill: commit to a bold aesthetic direction before coding; typography/color/motion/spatial composition/backgrounds at production quality; avoid generic fonts (Inter, Arial), purple-gradient cliches, and cookie-cutter layouts. Match implementation complexity to the vision (maximalist vs minimal).",
  },
  {
    id: "ui-ux-pro-max",
    title: "UI/UX Pro Max",
    category: "design",
    summary:
      "UI/UX intelligence: accessibility, touch, performance, style, responsive layout, typography/color systems, animation, forms, navigation, charts - see priority table in skill.",
    source: "builtin",
    tags: ["ui", "ux", "accessibility", "design"],
    instruction:
      "Follow UI/UX Pro Max when changing how UI looks, feels, moves, or is interacted with. Prioritize: accessibility, touch and interaction, performance, style selection, layout and responsive design, typography and color, animation, forms and feedback, navigation, charts. Apply structured UX checks; prefer semantic tokens, SVG icons over emoji, mobile-first breakpoints, visible focus, loading feedback, and meaningful motion.",
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
    .map((skill) => "Skill: " + skill.title + "\n" + skill.instruction);

  if (resolved.length === 0) {
    return "";
  }

  return "Active skills:\n\n" + resolved.join("\n\n");
};

export const getBuiltinSkills = (): SkillReference[] =>
  FALLBACK_SKILLS.map(cloneSkillReference);

export const getSkillById = (skillId: string): SkillReference | undefined =>
  getBuiltinSkills().find((skill) => skill.id === skillId);

export const getSkillInstruction = (skillId: string): string | null =>
  FALLBACK_SKILLS.find((skill) => skill.id === skillId)?.instruction ?? null;

export const listAvailableSkills = async (): Promise<SkillReference[]> => {
  try {
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

  try {
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
