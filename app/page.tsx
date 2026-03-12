import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FolderTree,
  PanelsTopLeft,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { MarketingShell } from "@/components/site/MarketingShell";

export const metadata: Metadata = {
  title: "Frontend AI Studio",
  description:
    "Generate full frontend applications with landing pages, app surfaces, pricing, privacy, and terms pages in one workspace.",
};

const features = [
  {
    title: "Multi-file generation",
    body: "Create real project trees with routes, components, styles, and utility files instead of one demo component.",
    icon: FolderTree,
  },
  {
    title: "Modern studio workflow",
    body: "Prompt on the left, inspect files and preview on the right, refine like v0, Lovable, or Bolt-style builders.",
    icon: PanelsTopLeft,
  },
  {
    title: "Frontend-only focus",
    body: "Designed for polished websites and apps without backend scaffolding, auth flows, or infrastructure noise.",
    icon: Waypoints,
  },
];

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Webmaker",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description:
      "Webmaker is a frontend-only AI studio for generating complete websites and React applications with full file structures.",
  };

  return (
    <MarketingShell>
      <section className="relative overflow-hidden px-5 pb-16 pt-10 lg:px-8 lg:pb-24 lg:pt-18">
        <div className="hero-mesh pointer-events-none absolute inset-0" />
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
          <div className="relative z-10 space-y-7">
            <p className="premium-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-[var(--wm-muted)]">
              <Sparkles size={14} className="text-[var(--wm-accent)]" />
              Full frontend application creation
            </p>
            <div className="space-y-4">
              <h1 className="font-display max-w-5xl text-5xl leading-[0.95] text-[var(--wm-text)] md:text-7xl lg:text-[5.3rem]">
                Build the landing page, the app, and the policy pages in one pass.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--wm-muted-soft)]">
                Webmaker turns a product prompt into a complete React frontend with a real file tree, reusable components, polished styling, and a live workspace to keep refining it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/studio" className="premium-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold">
                Open Studio
                <ArrowRight size={16} />
              </Link>
              <Link href="/pricing" className="premium-action inline-flex items-center gap-2 px-1 py-3 text-sm font-semibold text-[var(--wm-text)]">
                See Pricing
              </Link>
            </div>
          </div>

          <div className="relative z-10 overflow-hidden rounded-[2.2rem] border border-[var(--wm-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--wm-panel)_92%,var(--wm-bg)),color-mix(in_srgb,var(--wm-shell)_96%,var(--wm-bg)))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.2)]">
            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="border-l border-[var(--wm-accent)] pl-4">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">Prompt thread</p>
                <div className="mt-4 space-y-3 text-sm leading-7">
                  <div className="text-[var(--wm-muted-soft)]">
                    Create a premium legal-tech website with a client portal, pricing page, privacy policy, and terms.
                  </div>
                  <div className="text-[var(--wm-text)]">
                    Building 15 files across routes, navigation, dashboard components, and a shared design token stylesheet.
                  </div>
                </div>
              </div>
              <div className="border-l border-[var(--wm-border)] pl-4">
                <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">
                  <span>File tree</span>
                  <span className="rounded-full border border-[var(--wm-border)] bg-[var(--wm-panel-soft)] px-2.5 py-1 text-[10px] tracking-wider text-[var(--wm-muted)]">
                    Preview ready
                  </span>
                </div>
                <div className="mt-4 space-y-2 font-mono text-xs text-[var(--wm-muted-soft)]">
                  {[
                    "src/main.tsx",
                    "src/App.tsx",
                    "src/pages/HomePage.tsx",
                    "src/pages/AppPage.tsx",
                    "src/pages/PricingPage.tsx",
                    "src/pages/PrivacyPage.tsx",
                    "src/pages/TermsPage.tsx",
                    "src/components/Nav.tsx",
                    "src/styles.css",
                  ].map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 lg:px-8 lg:pb-14">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="border-l border-[var(--wm-border-strong)] pl-5">
                <Icon className="h-5 w-5 text-[var(--wm-accent)]" />
                <h2 className="mt-4 text-2xl font-semibold text-[var(--wm-text)]">{feature.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--wm-muted-soft)]">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-16 lg:px-8 lg:pb-24">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">Why teams switch</p>
            <h2 className="font-display mt-4 text-4xl leading-none text-[var(--wm-text)] md:text-5xl">
              One prompt becomes a complete, navigable frontend product.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Reusable components instead of one giant page",
              "Exportable file bundles for handoff and iteration",
              "Route-aware projects with app and marketing surfaces",
              "Design system continuity across every generated page",
            ].map((item) => (
              <div key={item} className="border-b border-[var(--wm-border)] pb-4 text-sm leading-7 text-[var(--wm-muted-soft)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </MarketingShell>
  );
}
