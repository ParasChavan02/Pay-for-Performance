"use client";
import Link from "next/link";
import { motion } from "motion/react";

export default function Finale() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 bg-primary-container text-on-primary text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl mx-auto"
      >
        <h2 className="font-headline font-bold text-3xl sm:text-5xl md:text-6xl tracking-tight mb-4 sm:mb-6">See it live.</h2>
        <p className="text-base sm:text-xl text-on-primary-container mb-8 sm:mb-10 max-w-xl mx-auto">
          Upload a contract, watch a breach happen, and approve the PayPal settlement.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
          <Link href="/upload" className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full bg-secondary-container text-on-secondary-container font-bold hover:opacity-95 transition-opacity shadow-lg">
            Start with an SLA
          </Link>
          <Link href="/dashboard" className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full border border-on-primary-container/40 text-on-primary font-semibold hover:bg-white/10 transition-colors">
            Open control center
          </Link>
        </div>
      </motion.div>
    </section>
  );
}