"use client";
import { motion } from "motion/react";

const words = "Don't pay for promises. Pay for verified performance.".split(" ");

export default function Hero() {
  return (
    <section className="h-screen flex flex-col items-center justify-center text-center px-6 relative">
      <h1 className="font-headline font-bold text-primary tracking-tight text-5xl md:text-8xl max-w-5xl leading-[1.05]">
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: i * 0.08,
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="inline-block mr-[0.25em]"
          >
            {word}
          </motion.span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="mt-8 text-xl text-on-surface-variant"
      >
        Money that responds to service quality.
      </motion.p>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="absolute bottom-10 text-outline text-sm"
      >
        scroll ↓
      </motion.div>
    </section>
  );
}