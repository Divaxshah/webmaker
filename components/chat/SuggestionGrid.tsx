"use client";

const SUGGESTIONS = [
  "Editorial fintech platform with landing page, dashboard, pricing, privacy, and terms",
  "AI travel planner with marketing site, itinerary builder app, and policy pages",
  "Modern legal-tech frontend with services site, case portal, pricing, and compliance pages",
  "Luxury real estate product with public listings, client portal, privacy, and terms",
  "Healthcare booking frontend with landing page, patient app shell, and trust pages",
  "Creative agency site with project showcase, proposal dashboard, pricing, and policy pages",
  "Developer SaaS with docs-style landing page, workspace UI, pricing, privacy, and terms",
  "Interior design studio with immersive landing page, client workspace, and legal pages",
];

interface SuggestionGridProps {
  onPick: (prompt: string) => void;
}

export function SuggestionGrid({ onPick }: SuggestionGridProps) {
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className="rounded-full border border-[var(--wm-border)] px-4 py-2 text-left text-xs leading-6 text-[var(--wm-text)] transition hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
