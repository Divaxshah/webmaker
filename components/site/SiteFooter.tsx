import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-background px-6 py-20 lg:px-12 font-sans">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-16 md:flex-row md:justify-between">
        
        <div className="flex flex-col gap-6 max-w-md">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 bg-primary text-primary-foreground flex items-center justify-center font-display text-2xl leading-none rounded-2xl rotate-3 group-hover:rotate-0 transition-transform">
              W
            </div>
            <span className="font-display text-2xl tracking-tight text-foreground font-bold">Webmaker</span>
          </Link>
          <p className="text-muted-foreground leading-relaxed text-lg">
            The multi-file frontend generation engine. Stop writing boilerplate, start generating products.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-16 font-medium text-foreground">
          <div className="flex flex-col gap-4">
            <span className="text-muted-foreground font-bold mb-2">Product</span>
            <Link href="/studio" className="hover:text-primary transition-colors">Studio</Link>
            <Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
          </div>
          <div className="flex flex-col gap-4">
            <span className="text-muted-foreground font-bold mb-2">Legal</span>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
      
      <div className="mx-auto max-w-[1400px] mt-20 pt-10 border-t border-border/50 text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
        <p>© {new Date().getFullYear()} Webmaker. All Rights Reserved.</p>
        <p>Built with Next.js & Shadcn UI.</p>
      </div>
    </footer>
  );
}
