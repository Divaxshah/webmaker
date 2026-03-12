import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Manrope, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

const code = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Webmaker",
    template: "%s | Webmaker",
  },
  description:
    "Webmaker is a frontend-only AI studio for generating complete product websites and multi-file React applications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootScript = `
    (function () {
      try {
        var saved = window.localStorage.getItem("webmaker-theme");
        var theme = saved === "light" || saved === "dark"
          ? saved
          : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
        document.documentElement.dataset.theme = theme;
      } catch (error) {
        document.documentElement.dataset.theme = "dark";
      }
    })();
  `;

  return (
    <html lang="en" className={cn("h-full", "font-sans", geist.variable)} data-theme="dark" suppressHydrationWarning>
      <body
        className={`${display.variable} ${body.variable} ${code.variable} min-h-full antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
