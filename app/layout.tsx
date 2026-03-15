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
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <nav
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "1rem 1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/"
              style={{
                color: "var(--text-primary)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1.05rem",
                letterSpacing: "-0.01em",
              }}
            >
              March Calmness
            </Link>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
              <Link
                href="/"
                style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}
              >
                Dashboard
              </Link>
              <Link
                href="/bracket"
                style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}
              >
                Bracket
              </Link>
              <Link
                href="/upload"
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }}
              >
                Upload PDF
              </Link>
            </div>
          </nav>
        </header>

        <main
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "2rem 1.5rem",
          }}
          className="page-enter"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
