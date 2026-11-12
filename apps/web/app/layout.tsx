import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SmoothScroll from "@/components/SmoothScroll";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["600", "700"] });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Pay-for-Performance",
  description: "Don't pay for promises. Pay for verified performance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('p4p-theme');
                if (saved === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch (e) {
                document.documentElement.classList.add('dark');
              }
            `,
          }}
        />
      </head>
      <body className={`${manrope.variable} ${jakarta.variable} min-h-screen antialiased bg-background text-on-surface`}>
        <SmoothScroll>
          <Navbar />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
