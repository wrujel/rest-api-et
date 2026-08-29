/**
 * Emits the single MONITOR_AUDIT line the Content Studio reads out of an audit
 * run's log.
 *
 * `pnpm audit --json` emits the npm-v6 shape: a `metadata.vulnerabilities`
 * tally plus an `advisories` map keyed by advisory id.
 *
 * The one rule worth restating: a missing or unreadable report emits NOTHING.
 * All-zero counts mean "audited, found nothing" — printing them for a scan that
 * never ran would publish a clean bill the repo has not earned.
 */
import { readFileSync } from "node:fs";

const REPORT = "audit.json";
const MAX_ADVISORIES = 20;

let report;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch {
  console.log("::warning::no readable audit report — emitting no sentinel");
  process.exit(0);
}

const tally = report?.metadata?.vulnerabilities;
if (!tally) {
  console.log(
    "::warning::audit report had no vulnerability metadata — emitting no sentinel",
  );
  process.exit(0);
}

// `info` folds into low; the studio's vocabulary has four severities.
const counts = {
  critical: tally.critical | 0,
  high: tally.high | 0,
  moderate: tally.moderate | 0,
  low: (tally.low | 0) + (tally.info | 0),
};

const advisories = [];
for (const advisory of Object.values(report.advisories ?? {})) {
  if (advisories.length >= MAX_ADVISORIES) break;
  const severity = String(advisory.severity ?? "unknown").toLowerCase();
  advisories.push({
    package: advisory.module_name,
    severity,
    ...(advisory.title ? { title: String(advisory.title).slice(0, 200) } : {}),
    ...(advisory.url ? { url: advisory.url } : {}),
  });
}

const total = counts.critical + counts.high + counts.moderate + counts.low;

console.log(
  "::notice title=audit::MONITOR_AUDIT " +
    JSON.stringify({ v: 1, counts, total, advisories }),
);
