import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "adaptive-agent",
  description:
    "Whether an agent's proposed change to its own future behavior has earned the right to stick, based on independent, diverse evidence rather than one loud incident.",
};

/**
 * Minimal App Router shell — infrastructure only, mirroring
 * agent-control-tower's own root layout shape (the current house
 * standard). No project-specific UI exists yet (that is M8's job); this
 * file's only reason to exist at genesis is so app/ has at least one real
 * entry point for `npm run typecheck` (tsconfig.json) and `npm run build`
 * to check, ahead of M1's contracts and M2's deployed health endpoint.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
