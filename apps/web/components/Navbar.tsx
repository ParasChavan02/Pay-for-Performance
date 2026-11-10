"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, Menu, X } from "lucide-react";

const storyLinks = [
  { href: "/#story", label: "The story" },
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
];

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload SLA" },
  { href: "/transactions", label: "Transactions" },
  { href: "/audit", label: "Audit trail" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
      pathname === href
        ? "bg-surface-container text-primary"
        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
    }`;

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1280px] mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <span className="font-headline font-bold text-xl text-primary">Pay-for-Performance</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {storyLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>
          ))}
          <span className="mx-2 h-5 w-px bg-outline-variant" />
          {appLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>
          ))}
        </nav>

        <button className="lg:hidden p-2 text-primary" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav className="lg:hidden bg-background border-t border-surface-container px-6 py-4 flex flex-col gap-1">
          {[...storyLinks, ...appLinks].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}