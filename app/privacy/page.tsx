import type { Metadata } from "next";
import { MarketingShell } from "@/components/site/MarketingShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Webmaker, the frontend-only AI studio for generating complete websites and React applications.",
};

const sections = [
  {
    title: "Prompt and project data",
    body: "Webmaker stores prompts, generated frontend files, and session metadata so your studio history remains available while you iterate.",
  },
  {
    title: "Frontend-only scope",
    body: "The product is designed for frontend generation only. It does not provision databases, servers, secrets, or backend infrastructure for generated projects.",
  },
  {
    title: "User control",
    body: "You can remove project history from the workspace. Generated code should still be reviewed for accessibility, legal, and brand requirements before launch.",
  },
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <section className="px-5 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">Privacy Policy</p>
          <h1 className="font-display mt-4 text-5xl leading-none text-[var(--wm-text)] md:text-6xl">
            Clear handling for prompts, sessions, and generated frontend files.
          </h1>
          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="border-l border-[var(--wm-border-strong)] pl-5">
                <h2 className="text-2xl font-semibold text-[var(--wm-text)]">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--wm-muted-soft)]">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
