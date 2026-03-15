import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "March Calmness",
  description: "A quiet bracket tracker for March Madness",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--bg)] text-[var(--text-primary)] antialiased">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-[var(--text-primary)] no-underline font-semibold text-[1.05rem] tracking-tight"
            >
              March Calmness
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-[var(--text-secondary)] no-underline text-sm hover:text-[var(--text-primary)] transition-colors duration-200"
              >
                Dashboard
              </Link>
              <Link
                href="/bracket"
                className="text-[var(--text-secondary)] no-underline text-sm hover:text-[var(--text-primary)] transition-colors duration-200"
              >
                Bracket
              </Link>
              <Link href="/upload" className="btn btn-primary text-[0.8rem]! py-[0.4rem]! px-4!">
                Upload PDF
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-[1200px] px-6 py-8 page-enter">
          {children}
        </main>
      </body>
    </html>
  );
}
