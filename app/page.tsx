/**
 * Placeholder home page — genesis only, no engine code and no domain logic.
 *
 * M2 will replace this with a deployed skeleton that exposes a real health
 * endpoint (app/api/health) backed by M1's frozen contracts. M8 will build
 * the actual interactive demo (live episode injection against the
 * support-triage domain from M6). Until then this page exists only so
 * `npm run build` has something real to render.
 */
export default function Home() {
  return (
    <main>
      <h1>Adaptive Agent</h1>
      <p>
        Whether an agent&rsquo;s proposed change to its own future behavior
        has earned the right to stick, based on independent, diverse
        evidence rather than one loud incident.
      </p>
      <p>
        This project is in progress. No live demo exists yet — see the
        README for current status.
      </p>
    </main>
  );
}
