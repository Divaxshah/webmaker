"use client";

import { motion } from "framer-motion";
import { MarketingShell } from "@/components/site/MarketingShell";

const sections = [
  {
    title: "1. Data Collection Architecture",
    body: "We collect prompts, generated frontend code structures, and session metadata to ensure your studio history remains accessible and intact. This allows you to iterate seamlessly across sessions. All interaction data is strictly scoped to the Webmaker Studio environment and is logged primarily for operational reliability.",
  },
  {
    title: "2. Focus on Frontend Scope",
    body: "Webmaker is strictly designed for frontend code generation. We do not provision backend databases, manage infrastructure, or store sensitive server-side secrets. Users are explicitly instructed NOT to input production database credentials, API keys, or Personally Identifiable Information (PII) into the AI prompt.",
  },
  {
    title: "3. User Control & Ownership",
    body: "You maintain full control over your project history within the workspace. Generated code is provided 'as-is'. It is entirely your responsibility to review the generated output for accessibility, legal compliance, and brand consistency before deploying to any production environment. We claim no ownership over the code exported from your sessions.",
  },
  {
    title: "4. Third-Party Sub-processors",
    body: "To generate applications, your prompts and contextual code are sent to our LLM partners. Data sent to these partners is governed by their respective API data privacy policies, which prohibit the use of API data for consumer model training. We do not use your private generated projects to train our internal generative models without explicit, opt-in consent.",
  }
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <section className="px-6 py-20 lg:px-12 bg-background min-h-[calc(100vh-5rem)] relative overflow-hidden">
        {/* Abstract Backgrounds */}
        <div className="absolute top-0 right-[20%] w-[40%] h-[40%] bg-primary/10 blur-[150px] rounded-full pointer-events-none -z-10" />
        
        <div className="mx-auto max-w-[1000px] relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 border-b border-border/50 pb-12"
          >
            <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight text-foreground mb-6 leading-[0.9]">
              Privacy <br/><span className="text-primary italic font-serif font-light">Policy.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed font-medium">
              Clear, uncompromising transparency regarding the handling of your prompts, sessions, and generated frontend infrastructure.
            </p>
          </motion.div>

          <div className="grid gap-8">
            {sections.map((section, idx) => (
              <motion.section 
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group p-8 rounded-[2rem] bg-card/40 backdrop-blur-md border border-white/5 hover:bg-card/80 transition-all shadow-lg shadow-black/5"
              >
                <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">
                  <h2 className="text-xl md:w-[300px] shrink-0 font-display tracking-tight font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                    {section.title}
                  </h2>
                  <div className="text-base text-muted-foreground leading-relaxed font-medium">
                    {section.body}
                  </div>
                </div>
              </motion.section>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-20 p-12 rounded-[2.5rem] bg-secondary/50 border border-white/10 flex flex-col md:flex-row justify-between items-center md:items-end gap-8 text-center md:text-left shadow-2xl"
          >
            <div className="max-w-lg">
               <h3 className="font-display text-4xl tracking-tight font-bold mb-4">Questions?</h3>
               <p className="text-base leading-relaxed text-muted-foreground font-medium">
                 If you have any questions or concerns about our privacy practices or data handling, please contact our Data Protection Officer.
               </p>
            </div>
            <a href="mailto:privacy@webmaker.dev" className="inline-flex h-14 items-center justify-center rounded-2xl bg-primary px-8 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
              Email Us
            </a>
          </motion.div>
        </div>
      </section>
    </MarketingShell>
  );
}
