"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

export default function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress: p } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // text fades in and out at different scroll points
  const t1 = useTransform(p, [0, 0.08, 0.28, 0.35], [0, 1, 1, 0]);
  const t2 = useTransform(p, [0.35, 0.42, 0.6, 0.66], [0, 1, 1, 0]);
  const t3 = useTransform(p, [0.66, 0.74, 1], [0, 1, 1]);

  // background turns red during the outage
  const bg = useTransform(
    p,
    [0.3, 0.45, 0.62, 0.7],
    ["#f9f9ff", "#ffdad6", "#ffdad6", "#f9f9ff"]
  );

  // uptime number falls from 100 to 97
  const uptime = useTransform(p, [0.35, 0.5], [100, 97]);
  const uptimeText = useTransform(uptime, (v) => `${v.toFixed(1)}%`);

  // green credit slice grows from 0 to 25%
  const creditW = useTransform(p, [0.7, 0.88], ["0%", "25%"]);

  return (
    <div ref={ref} className="h-[400vh] relative">
      <motion.div
        style={{ backgroundColor: bg }}
        className="sticky top-0 h-screen flex flex-col items-center justify-center px-6"
      >
        <div className="relative h-64 w-full max-w-4xl text-center">
          <motion.div
            style={{ opacity: t1 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <p className="text-sm font-bold uppercase text-secondary mb-3">Step 1</p>
            <h2 className="font-headline font-bold text-5xl md:text-7xl text-primary">
              $100 authorized.
            </h2>
            <p className="text-xl text-on-surface-variant mt-4">
              Held on PayPal. Not paid yet.
            </p>
          </motion.div>

          <motion.div
            style={{ opacity: t2 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <p className="text-sm font-bold uppercase text-error mb-3">Step 2</p>
            <h2 className="font-headline font-bold text-5xl md:text-7xl text-error">
              Uptime <motion.span>{uptimeText}</motion.span>
            </h2>
            <p className="text-xl text-on-surface-variant mt-4">
              The promise was 99.9%. Outage detected.
            </p>
          </motion.div>

          <motion.div
            style={{ opacity: t3 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <p className="text-sm font-bold uppercase text-secondary mb-3">Step 3</p>
            <h2 className="font-headline font-bold text-5xl md:text-7xl text-primary">
              Pay only for what worked.
            </h2>
            <p className="text-xl text-on-surface-variant mt-4">
              $25 credited back. $75 captured.
            </p>
          </motion.div>
        </div>

        <div className="mt-12 w-full max-w-2xl h-12 rounded-2xl overflow-hidden flex shadow-inner bg-primary">
          <motion.div
            style={{ width: creditW }}
            className="bg-secondary flex items-center justify-center text-on-secondary text-sm font-bold overflow-hidden"
          >
            $25
          </motion.div>
          <div className="flex-1 flex items-center justify-center text-on-primary text-sm font-bold">
            $75
          </div>
        </div>
      </motion.div>
    </div>
  );
}