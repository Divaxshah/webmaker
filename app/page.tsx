"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Layout, TerminalSquare, MousePointer2, Layers } from "lucide-react";
import { MarketingShell } from "@/components/site/MarketingShell";

const features = [
  {
    title: "Multi-file Architecture",
    body: "Generate full project structures. Routes, components, and stylesheets rendered in a unified file tree.",
    icon: TerminalSquare,
    colorClass: "bg-primary",
    hoverColor: "hover:bg-primary",
    textClass: "text-primary"
  },
  {
    title: "Live Workspace",
    body: "Prompt, edit, and preview in real-time. A completely integrated IDE environment built for speed.",
    icon: Layout,
    colorClass: "bg-accent",
    hoverColor: "hover:bg-accent",
    textClass: "text-accent"
  },
  {
    title: "Production Output",
    body: "Strictly typed React code, clean semantic HTML, and fully functional Tailwind utility classes.",
    icon: Code2,
    colorClass: "bg-orange-400",
    hoverColor: "hover:bg-orange-400",
    textClass: "text-orange-400"
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};

const titleVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const charVariants = {
  hidden: { opacity: 0, y: 60, rotateX: -90, scale: 0.8, filter: "blur(10px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    rotateX: 0, 
    scale: 1, 
    filter: "blur(0px)",
    transition: { 
      type: "spring" as const, 
      damping: 15, 
      stiffness: 100,
      mass: 0.5
    } 
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function HomePage() {
  const titleWords = "From Prompt to".split(" ");
  const highlightWord = "Production.".split("");

  return (
    <MarketingShell>
      {/* Hero Section */}
      <section className="relative px-6 lg:px-12 overflow-hidden flex items-center min-h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)]">
        {/* Animated Orbs */}
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full -z-10 animate-blob" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[150px] rounded-full -z-10 animate-blob animation-delay-4000" />
        
        {/* Floating Geometric Elements */}
        <motion.div 
          animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }} 
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] left-[15%] w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary/30 to-accent/30 border border-white/10 backdrop-blur-md hidden lg:block -z-10"
        />
        <motion.div 
          animate={{ y: [0, 40, 0], rotate: [0, -15, 0], scale: [1, 1.1, 1] }} 
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[30%] right-[15%] w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-secondary/20 border border-white/10 backdrop-blur-md hidden lg:block -z-10"
        />
        <motion.div 
          animate={{ x: [0, 20, 0], y: [0, 20, 0] }} 
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[40%] right-[25%] w-8 h-8 rounded-lg bg-primary/20 rotate-45 border border-primary/30 hidden lg:block -z-10"
        />

        <div className="mx-auto max-w-[1400px] w-full relative z-10 py-12 md:py-0">
          <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={containerVariants}
            className="flex flex-col items-center text-center max-w-5xl mx-auto"
          >
            <motion.div variants={titleVariants} className="font-display text-6xl md:text-8xl lg:text-[9rem] tracking-tight text-foreground mb-8 leading-[0.95] font-extrabold flex flex-col items-center justify-center perspective-[1000px] z-20">
              <div className="flex flex-wrap justify-center gap-x-4 md:gap-x-6 lg:gap-x-8 mb-2">
                {titleWords.map((word, idx) => (
                  <motion.span key={idx} variants={itemVariants} className="inline-block relative group">
                    {word}
                    <span className="absolute -bottom-2 left-0 w-0 h-1 bg-accent/50 transition-all duration-300 group-hover:w-full rounded-full" />
                  </motion.span>
                ))}
              </div>
              <div className="flex overflow-visible pb-4 pt-2 group cursor-default">
                {highlightWord.map((char, idx) => (
                  <motion.span 
                    key={idx} 
                    variants={charVariants} 
                    className="inline-block text-primary italic font-serif font-light transform-gpu drop-shadow-[0_0_15px_rgba(234,88,12,0.3)] hover:text-accent transition-colors duration-300 hover:scale-110 hover:-translate-y-2 hover:drop-shadow-[0_0_25px_rgba(234,88,12,0.6)]"
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </div>
            </motion.div>
            
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed font-medium mb-12 relative">
              <span className="absolute -left-6 md:-left-10 top-[-1rem] text-6xl text-primary/10 font-serif leading-none rotate-6">&ldquo;</span>
              Generate complete, multi-file React architectures instantly. 
              No boilerplate. No mockups. Just clean, deployable code.
              <span className="absolute -right-6 md:-right-10 bottom-[-2rem] text-6xl text-primary/10 font-serif leading-none rotate-180">&rdquo;</span>
            </motion.p>
              
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 items-center">
              <Link href="/studio" className="group relative inline-flex h-16 items-center justify-center rounded-full bg-primary px-10 text-lg font-bold text-primary-foreground transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_var(--color-primary)] hover:shadow-[0_0_60px_-10px_var(--color-primary)] overflow-hidden">
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[30deg] group-hover:animate-[shimmer_1.5s_infinite]" />
                <span className="relative z-10 flex items-center gap-3">
                  Start Building Now
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                </span>
              </Link>
              <Link href="/pricing" className="text-foreground font-bold hover:text-primary transition-colors flex items-center gap-2 group px-4 py-2 relative">
                View Pricing
                <div className="absolute bottom-1 left-4 right-4 h-0.5 bg-foreground scale-x-100 group-hover:bg-primary transition-all group-hover:scale-x-0 origin-left" />
                <div className="absolute bottom-1 left-4 right-4 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-all origin-right delay-75" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-32 px-6 lg:px-12 relative">
        <div className="absolute top-[20%] right-0 w-[30%] h-[30%] bg-primary/10 blur-[150px] rounded-full -z-10" />
        <div className="mx-auto max-w-[1400px] grid lg:grid-cols-12 gap-16 items-center">
           <motion.div 
             initial={{ opacity: 0, x: -50 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true, margin: "-100px" }}
             transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
             className="lg:col-span-7 relative group"
           >
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 via-accent/20 to-secondary/30 blur-3xl rounded-[4rem] -z-10 opacity-70 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative aspect-[4/3] md:aspect-video bg-card/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden transition-transform duration-700 hover:scale-[1.02]">
                <div className="absolute top-0 left-0 right-0 h-12 bg-white/5 backdrop-blur-md flex items-center px-6 gap-2 border-b border-white/5 z-20">
                   <div className="flex gap-2 group/dots cursor-pointer">
                     <div className="w-3.5 h-3.5 rounded-full bg-red-400/80 group-hover/dots:bg-red-400 transition-colors" />
                     <div className="w-3.5 h-3.5 rounded-full bg-amber-400/80 group-hover/dots:bg-amber-400 transition-colors" />
                     <div className="w-3.5 h-3.5 rounded-full bg-green-400/80 group-hover/dots:bg-green-400 transition-colors" />
                   </div>
                </div>
                
                <div className="p-8 md:p-12 pt-24 flex flex-col gap-6 h-full relative z-10">
                   <motion.div 
                     animate={{ x: [0, 5, 0] }} 
                     transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                     className="h-16 w-[80%] bg-primary/10 rounded-2xl border border-primary/20 flex items-center px-6 gap-4 shadow-lg shadow-primary/5"
                   >
                      <MousePointer2 className="h-5 w-5 text-primary/60 animate-pulse" />
                      <div className="h-2.5 w-48 bg-primary/30 rounded-full" />
                   </motion.div>
                   <motion.div 
                     animate={{ x: [0, -5, 0] }} 
                     transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                     className="h-32 w-full bg-accent/10 rounded-2xl border border-accent/20 flex flex-col justify-center px-8 gap-5 shadow-lg shadow-accent/5"
                   >
                      <div className="h-3 w-1/2 bg-accent/30 rounded-full" />
                      <div className="h-3 w-1/3 bg-accent/20 rounded-full" />
                   </motion.div>
                   <div className="grid grid-cols-2 gap-6 mt-auto">
                      <motion.div whileHover={{ scale: 1.05 }} className="h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl border border-primary/20 cursor-pointer transition-colors hover:bg-primary/20" />
                      <motion.div whileHover={{ scale: 1.05 }} className="h-24 bg-gradient-to-bl from-foreground/5 to-transparent rounded-2xl border border-white/10 cursor-pointer transition-colors hover:bg-white/10" />
                   </div>
                </div>
              </div>
           </motion.div>

           <div className="lg:col-span-5 flex flex-col gap-10">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-5xl md:text-6xl font-display font-bold tracking-tight leading-[1.1]">
                  Designed for <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent italic font-serif font-light pr-2">Precision.</span>
                </h2>
                <p className="text-lg text-muted-foreground font-medium leading-relaxed mt-6">
                  We don&apos;t just generate code; we architect systems. Every component is meticulously built to follow production standards and your specific design system.
                </p>
              </motion.div>
              
              <div className="grid gap-4 mt-2">
                 {[
                   { title: "Multi-Layer Architecture", desc: "Shared state and modular components.", delay: 0 },
                   { title: "Real-time Inspection", desc: "Live preview synchronization.", delay: 0.2 }
                 ].map((item, i) => (
                   <motion.div 
                     key={i} 
                     initial={{ opacity: 0, x: 20 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ duration: 0.5, delay: item.delay }}
                     className="group flex items-start gap-5 p-5 rounded-3xl bg-secondary/30 border border-white/5 transition-all hover:bg-card/80 hover:shadow-xl hover:shadow-black/5 hover:border-primary/20 cursor-pointer"
                   >
                      <div className="h-12 w-12 rounded-2xl bg-background shadow-inner flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                         <Layers className="h-6 w-6 text-foreground/50 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="mt-1">
                         <h4 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
                         <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                   </motion.div>
                 ))}
              </div>
           </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="px-6 py-32 lg:px-12 relative overflow-hidden">
        <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[150px] rounded-full -z-10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] max-w-4xl h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        
        <div className="mx-auto max-w-[1400px]">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-6 font-bold">
              The <span className="text-primary italic font-serif font-light">Workflow.</span>
            </h2>
            <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
              From prompt to production in three distinct phases.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { step: "01", title: "Prompt & Plan", desc: "Describe your product. Webmaker maps out the exact file structure and routing hierarchy needed." },
              { step: "02", title: "Generate & Build", desc: "Watch as the engine writes strictly typed React code and functional Tailwind styling." },
              { step: "03", title: "Inspect & Export", desc: "Interact with the live preview, review the code tree, and download a deployable bundle." }
            ].map((item, idx) => (
              <motion.div 
                key={item.step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.2, duration: 0.8, ease: "easeOut" }}
                className="relative p-10 rounded-[2.5rem] bg-card/60 backdrop-blur-xl border border-white/10 transition-all duration-500 group hover:-translate-y-4 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30"
              >
                <h3 className="text-2xl font-display tracking-tight font-bold mb-4">{item.title}</h3>
                <p className="text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-32 lg:px-12 bg-foreground text-background rounded-[3rem] md:rounded-[4rem] mx-4 md:mx-8 mb-12 relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/10 blur-[150px] rounded-full pointer-events-none" />
        
        {/* Grain Texture Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
        </div>

        <div className="mx-auto max-w-[1400px] relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24 flex flex-col items-center text-center"
          >
            <h2 className="font-display text-6xl md:text-8xl lg:text-[9rem] tracking-tighter mb-8 leading-[0.9] font-black">
              Production <br/>
              <span className="text-primary italic font-serif font-light drop-shadow-[0_0_20px_rgba(234,88,12,0.4)]">Standard.</span>
            </h2>
            <p className="text-xl md:text-2xl text-background/70 leading-relaxed max-w-3xl font-medium">
              We output real, structured React code you can actually use, deploy, and scale. No fluff, just clean engineering.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div 
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15, duration: 0.6 }}
                  className="group relative p-10 md:p-12 rounded-[2.5rem] bg-background/5 border border-white/10 backdrop-blur-sm transition-all duration-500 hover:bg-background/10 hover:border-white/20 hover:-translate-y-3 hover:shadow-2xl hover:shadow-black/50"
                >
                  <div className={`w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-10 transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:shadow-[0_0_30px_-5px_var(--color-primary)]`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-display tracking-tight font-bold mb-5 leading-tight">{feature.title}</h3>
                  <p className="text-background/60 leading-relaxed font-medium text-base">{feature.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
