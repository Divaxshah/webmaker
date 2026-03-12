import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/studio", label: "Studio" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--wm-border)] bg-[var(--wm-topbar)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--wm-border-strong)] bg-[var(--wm-panel)] shadow-[0_12px_36px_rgba(0,0,0,0.28)]">
            <span className="h-3.5 w-3.5 rounded-full bg-[var(--wm-accent)]" />
          </span>
          <div>
            <p className="font-display text-xl tracking-[0.18em] text-[var(--wm-text)]">WEBMAKER</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--wm-muted)]">
              Frontend studio
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[var(--wm-muted)] md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[var(--wm-text)]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/studio" className="premium-primary hidden rounded-xl px-4 py-2 text-sm font-semibold md:inline-flex">
            Open Studio
          </Link>
        </div>
      </div>
    </header>
  );
}
