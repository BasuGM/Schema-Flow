"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { installQaHooks, QaCrash } from "@/components/errors/qa-crash";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(installQaHooks, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <QaCrash region="root" />
        {children}
      </TooltipProvider>
    </ThemeProvider>
  );
}
