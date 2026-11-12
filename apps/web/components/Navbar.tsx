"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ShieldCheck, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

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

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
      pathname === href
        ? "bg-primary/10 text-primary font-bold"
        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
    }`;

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background/90 backdrop-blur-xl border-b border-outline-variant/30 dark:border-zinc-850">
      <div className="h-20 max-w-[1280px] mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary-container dark:bg-white text-on-primary dark:text-black flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
            <ShieldCheck size={22} />
          </div>
          <span className="font-headline font-bold text-lg sm:text-xl text-primary tracking-tight">
            Pay-for-Performance
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {storyLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-outline-variant/60" />
          {appLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          <div className="ml-3 pl-3 border-l border-outline-variant/60">
            <ThemeToggle />
          </div>
        </nav>

        {/* Mobile Controls */}
        <div className="flex lg:hidden items-center gap-2">
          <ThemeToggle />
          <button
            className="p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {open && (
        <nav className="lg:hidden bg-surface-container-lowest/95 backdrop-blur-2xl border-b border-outline-variant/40 px-4 py-4 flex flex-col gap-1 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Overview</p>
          {storyLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={linkClass(l.href)}
            >
              {l.label}
            </Link>
          ))}
          <div className="my-2 border-t border-outline-variant/40" />
          <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Platform</p>
          {appLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={linkClass(l.href)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
