"use client";

export type PreviewTab = "preview" | "code" | "console";

interface TabBarProps {
  activeTab: PreviewTab;
  onChange: (tab: PreviewTab) => void;
}

const tabs: Array<{ id: PreviewTab; label: string }> = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "Files" },
  { id: "console", label: "Console" },
];

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`border-b pb-2 transition ${
            activeTab === tab.id
              ? "border-[var(--wm-accent)] text-[var(--wm-text)]"
              : "border-transparent text-[var(--wm-muted)] hover:text-[var(--wm-text)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
