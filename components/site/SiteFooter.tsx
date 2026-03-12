import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--wm-border)] px-5 py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-sm text-[var(--wm-muted)] md:flex-row md:items-center md:justify-between">
        <p>
          Webmaker is a frontend-only generation studio for full product surfaces,
          marketing sites, and multi-file React apps.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="transition hover:text-[var(--wm-text)]">
            Pricing
          </Link>
          <Link href="/privacy" className="transition hover:text-[var(--wm-text)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-[var(--wm-text)]">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
