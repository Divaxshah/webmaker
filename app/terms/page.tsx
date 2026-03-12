import type { Metadata } from "next";
import { MarketingShell } from "@/components/site/MarketingShell";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for Webmaker, including review expectations for generated frontend projects.",
};

const terms = [
  "Generated projects are editable starting points and should be reviewed before production use.",
  "You keep ownership of the prompts and frontend code you create in Webmaker, subject to applicable law.",
  "Webmaker does not guarantee legal compliance, accessibility compliance, or production readiness without human review.",
  "The service is focused on frontend output and should not be treated as a backend hosting or infrastructure platform.",
];

export default function TermsPage() {
  return (
    <MarketingShell>
      <section className="px-5 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">Terms of Use</p>
          <h1 className="font-display mt-4 text-5xl leading-none text-[var(--wm-text)] md:text-6xl">
            Terms for generating and exporting frontend products.
          </h1>
          <div className="mt-10 space-y-4">
            {terms.map((term) => (
              <div key={term} className="border-b border-[var(--wm-border)] pb-4 text-sm leading-7 text-[var(--wm-muted-soft)]">
                {term}
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
