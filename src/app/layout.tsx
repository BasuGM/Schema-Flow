import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchemaFlow — Database Schema Explorer",
  description:
    "Explore database schemas as interactive entity relationship diagrams. Runs entirely in your browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the theme class on <html> before hydration; the mismatch is expected.
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
