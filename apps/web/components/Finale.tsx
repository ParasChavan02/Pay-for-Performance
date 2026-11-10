"use client";
import Link from "next/link";
import { motion } from "motion/react";

export default function Finale() {
  return (
    <section className="py-32 px-6 bg-primary-container text-on-primary text-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl mx-auto"
      >
        <h2 className="font-headline font-bold text-5xl md:text-6xl tracking-tight mb-6">See it live.</h2>
        <p className="text-xl text-on-primary-container mb-10">
          Upload a contract, watch a breach happen, and approve the payment.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/upload" className="px-8 py-4 rounded-full bg-secondary-container text-on-secondary-container font-semibold hover:opacity-90 transition-opacity">
            Start with an SLA
          </Link>
          <Link href="/dashboard" className="px-8 py-4 rounded-full border border-on-primary-container/40 text-on-primary font-semibold hover:bg-white/10 transition-colors">
            Open dashboard
          </Link>
        </div>
      </motion.div>
    </section>
  );
}