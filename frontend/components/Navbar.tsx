import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1280px] mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <span className="font-headline font-bold text-xl text-primary">
            Pay-for-Performance
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/dashboard" className="px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}