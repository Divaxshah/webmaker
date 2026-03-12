import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/site/MarketingShell";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Pricing for Webmaker, the frontend-only AI studio for complete product websites and multi-file React apps.",
};

const plans = [
  {
    name: "Starter",
    price: "$29",
    body: "For solo builders shipping polished marketing sites and lightweight app shells.",
    features: ["25 project generations", "Multi-file bundle export", "Landing and policy page support"],
  },
  {
    name: "Studio",
    price: "$89",
    body: "For product teams building full frontend experiences with repeatable quality.",
    features: ["Unlimited generations", "Advanced model access", "Deeper workspace history"],
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="px-5 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">Pricing</p>
            <h1 className="font-display mt-4 text-5xl leading-none text-[var(--wm-text)] md:text-6xl">
              Pricing built for frontend shipping velocity.
            </h1>
            <p className="mt-4 text-lg leading-8 text-[var(--wm-muted-soft)]">
              Pick a plan based on how often you need complete site and app surfaces, not just isolated components.
            </p>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.name} className="border-l border-[var(--wm-border-strong)] pl-5">
                <p className="text-sm uppercase tracking-[0.26em] text-[var(--wm-muted)]">{plan.name}</p>
                <p className="mt-4 text-5xl font-semibold text-[var(--wm-text)]">
                  {plan.price}
                  <span className="ml-2 text-base font-normal text-[var(--wm-muted)]">/ month</span>
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--wm-muted-soft)]">{plan.body}</p>
                <ul className="mt-6 space-y-3 text-sm text-[var(--wm-text)]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="border-b border-[var(--wm-border)] pb-3">
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-10 text-sm text-[var(--wm-muted-soft)]">
            Need a live walkthrough? <Link href="/studio" className="text-[var(--wm-text)] underline underline-offset-4">Open the studio</Link> and inspect the workspace before you commit.
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
