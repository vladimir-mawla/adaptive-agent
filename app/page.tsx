import { AdaptiveAgentDemo } from "../components/AdaptiveAgentDemo";

/**
 * M8's own page — the interactive demo (plan §3, M8: "Files it owns...
 * `app/page.tsx`"). Replaces the M2 placeholder with the real thing: live
 * episode injection against the real `support-triage` domain engine,
 * rendered by `components/AdaptiveAgentDemo.tsx`. This file itself owns no
 * logic — it is a thin App Router entry point, matching the shape M2's own
 * placeholder comment predicted it would take.
 */
export default function Home() {
  return <AdaptiveAgentDemo />;
}
