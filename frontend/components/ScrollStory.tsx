"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";

type P = MotionValue<number>;

const scenes: { range: [number, number]; tag: string; title: string; text: string }[] = [
  { range: [0, 0.17], tag: "Step 1", title: "You buy, we hold", text: "$100 is authorized on PayPal. It is reserved for the vendor, but not paid yet." },
  { range: [0.15, 0.34], tag: "Step 2", title: "AI reads the contract", text: "It pulls out the promises: uptime, speed and what happens if they are broken." },
  { range: [0.32, 0.52], tag: "Step 3", title: "We watch the service", text: "Live monitoring catches the outage. Uptime hits 97%, not the promised 99.9%." },
  { range: [0.5, 0.67], tag: "Step 4", title: "Math decides, not AI", text: "A rules engine works out the credit. Same input, same answer, every time." },
  { range: [0.65, 0.83], tag: "Step 5", title: "A human stays in control", text: "Big payouts wait for approval. Nothing moves on its own." },
  { range: [0.81, 1], tag: "Step 6", title: "Everyone gets what is fair", text: "$75 goes to the vendor. $25 comes back to you. Every dollar has a receipt." },
];

// one scene = fades + slides in at its range, then out
function Scene({
  p, range, className = "", children,
}: { p: P; range: [number, number]; className?: string; children: React.ReactNode }) {
  const [a, b] = range;
  const f = (b - a) * 0.18;
  const first = a <= 0; // first scene starts visible
  const last = b >= 1; // last scene stays visible
  const opacity = useTransform(p, [a, a + f, b - f, b], [first ? 1 : 0, 1, 1, last ? 1 : 0]);
  const y = useTransform(p, [a, a + f, b - f, b], [first ? 0 : 24, 0, 0, last ? 0 : -24]);
  return (
    <motion.div style={{ opacity, y }} className={`absolute inset-0 ${className}`}>
      {children}
    </motion.div>
  );
}

function Chip({ p, start, text }: { p: P; start: number; text: string }) {
  const opacity = useTransform(p, [start, start + 0.03], [0, 1]);
  const x = useTransform(p, [start, start + 0.03], [-16, 0]);
  return (
    <motion.div style={{ opacity, x }} className="px-4 py-2 rounded-full bg-secondary-container/50 text-on-secondary-container font-bold text-sm">
      ✓ {text}
    </motion.div>
  );
}

function Monitor({ p }: { p: P }) {
  const draw = useTransform(p, [0.34, 0.47], [0, 1]);
  const up = useTransform(p, [0.36, 0.47], [100, 97]);
  const upText = useTransform(up, (v) => `${v.toFixed(1)}%`);
  return (
    <div className="h-full flex items-center justify-center gap-6">
      <div className="text-6xl">📡</div>
      <div className="w-64">
        <svg viewBox="0 0 240 100" className="w-full">
          <line x1="0" y1="20" x2="240" y2="20" stroke="#ba1a1a" strokeDasharray="4 4" />
          <motion.path
            d="M0 14 L60 14 L100 18 L140 70 L180 78 L240 74"
            fill="none" stroke="#00457c" strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ pathLength: draw }}
          />
        </svg>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xs text-on-surface-variant">promise 99.9%</span>
          <motion.span className="font-headline font-bold text-2xl text-error">{upText}</motion.span>
        </div>
      </div>
    </div>
  );
}

function ApproveButton({ p }: { p: P }) {
  const scale = useTransform(p, [0.7, 0.73, 0.76], [1, 0.92, 1]);
  const bg = useTransform(p, [0.72, 0.75], ["#00457c", "#006d37"]);
  const label = useTransform(p, (v) => (v > 0.74 ? "✅ Approved" : "Approve"));
  return (
    <motion.div style={{ scale, backgroundColor: bg }} className="px-6 py-2 rounded-full text-white font-bold text-sm inline-block">
      <motion.span>{label}</motion.span>
    </motion.div>
  );
}

export default function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // whole section changes mood: calm -> red outage -> calm -> green settled
  const bg = useTransform(
    p,
    [0, 0.3, 0.38, 0.5, 0.6, 0.85, 0.95],
    ["#f9f9ff", "#f9f9ff", "#ffdad6", "#ffdad6", "#f9f9ff", "#f9f9ff", "#e3f8ea"]
  );

  // cash 1: buyer -> PayPal, then waits (held)
  const cashLeft = useTransform(p, [0.02, 0.14], ["12%", "50%"]);
  const cashOpacity = useTransform(p, [0, 0.03, 0.82, 0.85], [0, 1, 1, 0]);
  const lockOpacity = useTransform(p, [0.12, 0.16, 0.82, 0.85], [0, 1, 1, 0]);

  // final split: refund back to buyer, rest to vendor
  const splitOpacity = useTransform(p, [0.84, 0.86], [0, 1]);
  const refundLeft = useTransform(p, [0.86, 0.97], ["50%", "12%"]);
  const vendorLeft = useTransform(p, [0.86, 0.97], ["50%", "88%"]);

  return (
    <div ref={ref} className="h-[500vh] relative">
      <motion.div style={{ backgroundColor: bg }} className="sticky top-0 h-screen pt-20 flex items-center">
        <div className="w-full max-w-[1280px] mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
          {/* left: captions */}
          <div>
            <div className="relative h-52">
              {scenes.map((s) => (
                <Scene key={s.title} p={p} range={s.range} className="flex flex-col justify-center">
                  <p className="text-sm font-bold uppercase text-secondary mb-2">{s.tag}</p>
                  <h2 className="font-headline font-bold text-4xl md:text-5xl text-primary tracking-tight">{s.title}</h2>
                  <p className="text-lg text-on-surface-variant mt-3 max-w-md">{s.text}</p>
                </Scene>
              ))}
            </div>
            <div className="mt-8 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <motion.div style={{ scaleX: p }} className="h-full origin-left bg-secondary" />
            </div>
          </div>

          {/* right: the animated stage */}
          <div className="relative h-[420px] lg:h-[480px] rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xl overflow-hidden">
            {/* top area: what is happening now */}
            <div className="absolute left-4 right-4 top-4 bottom-[46%]">
              <Scene p={p} range={scenes[0].range}>
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-bold uppercase text-on-surface-variant">PayPal order</p>
                  <p className="font-headline font-bold text-3xl text-primary">Authorized, not captured</p>
                  <p className="text-sm text-on-surface-variant mt-1">Money is reserved. Nobody has been paid.</p>
                </div>
              </Scene>

              <Scene p={p} range={scenes[1].range}>
                <div className="h-full flex items-center justify-center gap-5">
                  <div className="text-6xl">📄</div>
                  <div className="flex flex-col gap-2">
                    <Chip p={p} start={0.2} text="99.9% uptime" />
                    <Chip p={p} start={0.24} text="300 ms latency" />
                    <Chip p={p} start={0.28} text="25% credit if broken" />
                  </div>
                </div>
              </Scene>

              <Scene p={p} range={scenes[2].range}>
                <Monitor p={p} />
              </Scene>

              <Scene p={p} range={scenes[3].range}>
                <div className="h-full flex items-center justify-center gap-5">
                  <div className="text-6xl">⚖️</div>
                  <div className="p-4 rounded-2xl bg-surface-container text-center">
                    <p className="text-xs font-bold uppercase text-on-surface-variant">Rules engine</p>
                    <p className="font-headline font-bold text-2xl text-primary mt-1">25% × $100</p>
                    <p className="font-headline font-bold text-3xl text-secondary">= $25 credit</p>
                  </div>
                </div>
              </Scene>

              <Scene p={p} range={scenes[4].range}>
                <div className="h-full flex items-center justify-center gap-5">
                  <div className="text-6xl">🧑‍💼</div>
                  <div className="p-4 rounded-2xl bg-surface-container text-center">
                    <p className="text-xs font-bold uppercase text-on-surface-variant">Policy gate</p>
                    <p className="text-sm text-on-surface-variant mt-1 mb-3">Credit above the auto limit, so a human decides</p>
                    <ApproveButton p={p} />
                  </div>
                </div>
              </Scene>

              <Scene p={p} range={scenes[5].range}>
                <div className="h-full flex items-center justify-center gap-5">
                  <div className="text-6xl">🧾</div>
                  <div>
                    <p className="font-headline font-bold text-xl text-primary">Every dollar has a receipt</p>
                    <p className="text-sm text-on-surface-variant mt-1">Clause → metric → calculation → approval → PayPal ID</p>
                  </div>
                </div>
              </Scene>
            </div>

            {/* money tokens */}
            <motion.div style={{ left: cashLeft, opacity: cashOpacity, x: "-50%" }} className="absolute bottom-[28%] flex flex-col items-center">
              <span className="text-5xl">💸</span>
              <span className="px-3 py-1 rounded-full bg-primary text-on-primary text-sm font-bold">$100</span>
            </motion.div>

            <motion.div style={{ left: refundLeft, opacity: splitOpacity, x: "-50%" }} className="absolute bottom-[28%] flex flex-col items-center">
              <span className="text-5xl">💰</span>
              <span className="px-3 py-1 rounded-full bg-secondary text-on-secondary text-sm font-bold">$25</span>
            </motion.div>

            <motion.div style={{ left: vendorLeft, opacity: splitOpacity, x: "-50%" }} className="absolute bottom-[28%] flex flex-col items-center">
              <span className="text-5xl">💸</span>
              <span className="px-3 py-1 rounded-full bg-primary text-on-primary text-sm font-bold">$75</span>
            </motion.div>

            {/* actors, always on stage */}
            <div className="absolute bottom-5 flex flex-col items-center -translate-x-1/2" style={{ left: "12%" }}>
              <span className="text-5xl">🧑‍💻</span>
              <span className="text-xs font-bold text-on-surface-variant mt-1">You</span>
            </div>

            <div className="absolute bottom-5 flex flex-col items-center -translate-x-1/2" style={{ left: "50%" }}>
              <div className="px-4 py-3 rounded-2xl bg-white shadow-md border border-surface-container flex flex-col items-center">
                <span className="font-extrabold italic text-lg">
                  <span className="text-[#003087]">Pay</span>
                  <span className="text-[#009cde]">Pal</span>
                </span>
                <motion.span style={{ opacity: lockOpacity }} className="text-xs font-bold text-secondary">🔒 held</motion.span>
              </div>
            </div>

            <div className="absolute bottom-5 flex flex-col items-center -translate-x-1/2" style={{ left: "88%" }}>
              <span className="text-5xl">🏢</span>
              <span className="text-xs font-bold text-on-surface-variant mt-1">Vendor</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}