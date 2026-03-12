"use client";

import { motion } from "framer-motion";
import { MarketingShell } from "@/components/site/MarketingShell";

const terms = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing and using Webmaker Studio, you accept and agree to be bound by the terms and provision of this agreement. These terms apply to all visitors, users, and others who access the service."
  },
  {
    title: "2. Nature of Generated Output",
    body: "All generated projects, code snippets, styles, and UI components are provided as EDITABLE STARTING POINTS. They are explicitly NOT guaranteed to be production-ready, secure, or bug-free. The generated output must be thoroughly reviewed, tested, and audited by human developers for security vulnerabilities, accessibility compliance (WCAG), and functional correctness before deployment."
  },
  {
    title: "3. Intellectual Property Rights",
    body: "You retain all intellectual property rights, copyright, and ownership over the prompts you submit and the resulting frontend code output generated specifically for you during your session. Webmaker claims no copyright over the generated output."
  },
  {
    title: "4. Disclaimer of Warranty",
    body: "The service is provided strictly on an 'AS IS' and 'AS AVAILABLE' basis, without warranty of any kind. Webmaker expressly disclaims all warranties, whether express, implied, or statutory, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, and non-infringement."
  },
  {
    title: "5. Acceptable Use Policy",
    body: "You agree NOT to use the service to generate malicious code, malware, phishing templates, interfaces designed to deceive end users (dark patterns), or any content that violates applicable laws. Violation results in immediate termination."
  },
  {
    title: "6. Limitation of Liability",
    body: "In no event shall Webmaker, its directors, employees, partners, or agents be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses."
  }
];

export default function TermsPage() {
  return (
    <MarketingShell>
      <section className="px-6 py-20 lg:px-12 bg-background min-h-[calc(100vh-5rem)] relative overflow-hidden">
        {/* Abstract Backgrounds */}
        <div className="absolute top-[30%] left-[-10%] w-[50%] h-[50%] bg-accent/10 blur-[150px] rounded-full pointer-events-none -z-10" />

        <div className="mx-auto max-w-[1000px] relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 border-b border-border/50 pb-12"
          >
            <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight text-foreground mb-6 leading-[0.9]">
              Terms of <br/><span className="text-accent italic font-serif font-light">Service.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed font-medium">
              Rules, expectations, and liabilities regarding the generation, export, and deployment of frontend products via Webmaker.
            </p>
          </motion.div>

          <div className="grid gap-6">
            {terms.map((term, idx) => (
              <motion.div 
                key={term.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.05 }}
                className="group rounded-3xl bg-card/40 backdrop-blur-md border border-white/5 flex flex-col md:flex-row overflow-hidden shadow-lg hover:shadow-xl hover:border-accent/30 transition-all"
              >
                <div className="p-8 md:w-[300px] bg-secondary/30 group-hover:bg-accent/10 transition-colors flex items-center">
                  <h3 className="text-xl font-display tracking-tight font-bold leading-tight text-foreground group-hover:text-accent transition-colors">{term.title}</h3>
                </div>
                <div className="p-8 flex-1 bg-card/20">
                  <p className="text-base text-muted-foreground leading-relaxed font-medium">{term.body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-16 flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest px-4"
          >
            <span>WM_TERMS_V2.0.4</span>
            <span>Last Updated: March 12, 2026</span>
          </motion.div>
        </div>
      </section>
    </MarketingShell>
  );
}
