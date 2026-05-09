"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, easeOut } from "framer-motion";
import { ArrowRight, TrendingUp, Zap, Shield, Users, BarChart3, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: easeOut },
    },
  };

  const features = [
    {
      icon: TrendingUp,
      title: "Real-time CVR-data",
      desc: "Live opdateringer fra Danmarks officielle virksomhedsregister",
    },
    {
      icon: Zap,
      title: "AI-drevet lead scoring",
      desc: "Automatisk identificering af dine mest lovende prospects",
    },
    {
      icon: Shield,
      title: "GDPR-compliance",
      desc: "Fuld overholdelse af EU's databeskyttelsesregler",
    },
    {
      icon: Users,
      title: "Team-samarbejde",
      desc: "Del indsigter og leads på tværs af organisationen",
    },
    {
      icon: BarChart3,
      title: "Predictive analytics",
      desc: "Se hvilke virksomheder der sandsynligt vokser næste måned",
    },
    {
      icon: Rocket,
      title: "Sømløs integration",
      desc: "Forbind direkte til din CRM og sales tools",
    },
  ];

  return (
    <main ref={containerRef} className="relative overflow-hidden bg-black text-white">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-black to-black" />
        <motion.div
          className="absolute top-0 -left-1/4 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl"
          animate={{
            y: [0, 50, 0],
            x: [0, 30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 -right-1/4 w-96 h-96 rounded-full bg-cyan-600/10 blur-3xl"
          animate={{
            y: [0, -50, 0],
            x: [0, -30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
        />
      </div>

      {/* Hero Section */}
      <motion.section
        style={{ opacity, scale }}
        className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20"
          >
            <span className="text-sm font-semibold text-blue-400">AI-drevet B2B Lead Intelligence</span>
            <ArrowRight className="size-4" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-7xl font-black tracking-tight mb-6 bg-gradient-to-r from-white via-blue-100 to-cyan-400 bg-clip-text text-transparent"
          >
            Find dine næste vækstmuligheder før konkurrencen gør
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            CVR-MATE transformerer danske CVR-data til handlingsorienteret indsigt. Identificer købeklaare virksomheder i realtid og accelerer din salgsproces.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/signup">
              <Button variant="gradient" size="lg" className="text-base font-bold">
                Start gratis <ArrowRight className="ml-2 size-5" />
              </Button>
            </Link>
            <Link href="#contact">
              <Button variant="outline" size="lg" className="text-base font-bold">
                Book demo
              </Button>
            </Link>
          </motion.div>

          {/* Animated stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-slate-800"
          >
            {[
              { num: "500+", label: "Danske virksomheder" },
              { num: "99.9%", label: "Data-nøjagtighed" },
              { num: "24/7", label: "Live opdateringer" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <div className="text-3xl font-bold text-white">{stat.num}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.h2
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-black mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent"
            >
              Enterprise-grade intelligens til B2B-sales
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-xl text-slate-400 max-w-2xl mx-auto"
            >
              Seks kernefeaturer designet til moderne salgsteams
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/50 border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="inline-flex p-3 rounded-lg bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors"
                >
                  <feature.icon className="size-6 text-blue-400" />
                </motion.div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.h2
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-black mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent"
            >
              Pricing til virksomheder af alle størelser
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                name: "Starter",
                price: "Fra 199 kr/md",
                features: ["50 søgninger/md", "AI-briefings", "Email integration"],
              },
              {
                name: "Professional",
                price: "Fra 999 kr/md",
                features: ["Fuld CRM-integration", "AI-scoring", "Person tracking"],
                highlight: true,
              },
              {
                name: "Enterprise",
                price: "Custom pris",
                features: ["Ubegrænset tilgang", "Dedicated support", "Custom API"],
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                className={`p-8 rounded-2xl transition-all duration-300 ${
                  plan.highlight
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 border border-blue-400/50 ring-2 ring-blue-500/50"
                    : "bg-slate-900/50 border border-slate-700/50 hover:border-blue-500/30"
                }`}
              >
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="text-3xl font-black text-blue-400 mb-6">{plan.price}</div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  className="w-full"
                >
                  Kom i gang
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
        className="relative py-24 px-4 sm:px-6 lg:px-8"
        id="contact"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            variants={itemVariants}
            className="text-4xl sm:text-5xl font-black mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent"
          >
            Klar til at transformere din salgsproces?
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto"
          >
            Join 500+ danske virksomheder der bruger CVR-MATE til at scale deres B2B-salg
          </motion.p>
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/signup">
              <Button variant="gradient" size="lg" className="text-base font-bold">
                Start gratis i dag
              </Button>
            </Link>
            <a href="mailto:demo@cvr-mate.dk">
              <Button variant="outline" size="lg" className="text-base font-bold">
                Request demo
              </Button>
            </a>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
          <p>© 2026 CVR-MATE. Alle rettigheder forbeholdes.</p>
        </div>
      </footer>
    </main>
  );
}
