"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight, Minus } from "lucide-react";
import { MarketingShell } from "@/components/site/MarketingShell";

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    description: "For solo builders shipping polished marketing sites and lightweight app shells.",
    features: [
      "25 project generations per month",
      "Multi-file bundle export (.zip)",
      "Standard React & Next.js templates",
      "Community support access",
      "Standard LLM reasoning models"
    ],
    limitations: [
      "No custom design system injection",
      "No private repository sync",
      "Standard priority queue"
    ],
    cta: "Start Building",
    highlighted: false,
    colorClass: "border-blue-600",
    shadowClass: "shadow-[12px_12px_0_0_#2563eb]",
    bgClass: "bg-blue-600",
    textClass: "text-blue-600"
  },
  {
    name: "Pro Studio",
    price: "$89",
    period: "/mo",
    description: "For product teams building full frontend experiences with repeatable quality.",
    features: [
      "Unlimited project generations",
      "Advanced model access (GPT-4o, Claude 3.5 Sonnet)",
      "Deeper workspace history retention",
      "Custom UI component library injection",
      "Export directly to GitHub/GitLab",
      "Priority generation queue",
      "Dedicated email support"
    ],
    limitations: [],
    cta: "Upgrade to Pro",
    highlighted: true,
    colorClass: "border-emerald-500",
    shadowClass: "shadow-[12px_12px_0_0_#10b981]",
    bgClass: "bg-emerald-500",
    textClass: "text-emerald-500"
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="px-6 py-20 lg:px-12 bg-background relative min-h-[calc(100vh-5rem)] flex flex-col justify-center">
        {/* Abstract Backgrounds */}
        <div className="absolute top-[10%] left-[20%] w-[30%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[30%] bg-accent/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <div className="mx-auto max-w-[1400px] w-full relative z-10">
          <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={containerVariants}
            className="flex flex-col md:flex-row md:items-end justify-between gap-8"
          >
            <div className="max-w-2xl">
              <motion.h1 variants={itemVariants} className="font-display text-5xl md:text-7xl tracking-tight text-foreground mb-4 leading-[0.9] font-black">
                Pricing for <br/><span className="text-primary italic font-serif font-light">Velocity.</span>
              </motion.h1>
              
              <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
                Pick a plan based on how often you need complete surfaces. Cancel anytime.
              </motion.p>
            </div>
            <motion.div variants={itemVariants} className="hidden md:block">
              <Link href="mailto:contact@webmaker.dev" className="inline-flex h-14 items-center justify-center rounded-full bg-secondary/80 backdrop-blur-md px-8 text-sm font-bold text-foreground transition-all hover:bg-foreground hover:text-background shadow-lg shadow-black/5">
                Contact Sales
              </Link>
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="grid lg:grid-cols-2 gap-8 mt-12 md:mt-16 items-center"
          >
            {plans.map((plan) => (
              <div 
                key={plan.name} 
                className={`relative flex flex-col rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 bg-card/60 backdrop-blur-2xl border ${plan.highlighted ? 'border-primary shadow-2xl shadow-primary/20 scale-100 lg:scale-105 z-10' : 'border-white/10 shadow-xl scale-100 z-0'}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 right-8 bg-primary text-primary-foreground font-bold px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-primary/30">
                    Most Popular
                  </div>
                )}
                
                <div className="p-8 md:p-10 border-b border-white/5">
                  <h2 className="font-display text-3xl tracking-tight font-bold mb-3">{plan.name}</h2>
                  <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-6 h-10">{plan.description}</p>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-6xl tracking-tighter font-black">{plan.price}</span>
                    <span className="text-lg text-muted-foreground font-bold">{plan.period}</span>
                  </div>
                </div>

                <div className="p-8 md:p-10 flex-1 flex flex-col">
                  <div className="font-bold uppercase tracking-widest text-[10px] mb-6 text-foreground/50">
                    Included Features
                  </div>
                  <ul className="space-y-4 text-sm flex-1 mb-10">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-full p-1 ${plan.highlighted ? 'bg-primary/20 text-primary' : 'bg-secondary text-foreground'}`}>
                          <Check className="w-3 h-3 shrink-0" />
                        </div>
                        <span className="text-foreground font-medium leading-relaxed">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start gap-3 opacity-50">
                        <div className="mt-0.5 rounded-full p-1 bg-secondary text-muted-foreground">
                          <Minus className="w-3 h-3 shrink-0" />
                        </div>
                        <span className="text-muted-foreground font-medium leading-relaxed">{limitation}</span>
                      </li>
                    ))}
                  </ul>

                  <Link 
                    href="/studio" 
                    className={`inline-flex h-14 w-full items-center justify-center rounded-2xl px-8 text-sm font-bold transition-all ${plan.highlighted ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-105 active:scale-95' : 'bg-secondary text-foreground hover:bg-foreground hover:text-background'}`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-3 h-5 w-5" />
                  </Link>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
    </MarketingShell>
  );
}
