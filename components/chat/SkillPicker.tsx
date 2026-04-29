"use client";

import type { SkillReference } from "@/lib/types";

interface SkillPickerProps {
  skills: SkillReference[];
  activeSkillIds: string[];
  onToggle: (skillId: string) => void;
}

export function SkillPicker({
  skills,
  activeSkillIds,
  onToggle,
}: SkillPickerProps) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => {
        const isActive = activeSkillIds.includes(skill.id);
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => onToggle(skill.id)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            title={skill.summary}
          >
            {skill.title}
          </button>
        );
      })}
    </div>
  );
}
