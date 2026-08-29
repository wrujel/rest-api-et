/**
 * Emits the single MONITOR_COVERAGE line the Content Studio reads out of a CI
 * run's log.
 *
 * This repo ships two suites — the Express API at the root and the Angular
 * dashboard under frontend/angular — but a project maps to exactly ONE
 * percentage in the studio. Rather than picking a favourite, the covered and
 * total line counts are summed across both, so the number describes the
 * deployed artifact as a whole (the API serves the dashboard).
 *
 * Every read is best-effort: a suite that never produced a report contributes
 * nothing rather than dragging the figure toward a fictional zero. If neither
 * suite reported, the payload is `{"pct":null}` and the studio shows "n/a",
 * which is the honest answer.
 */
import { readFileSync } from "node:fs";

/** istanbul json-summary files, in the order the suites run. */
const SUMMARIES = [
  "coverage/coverage-summary.json",
  "frontend/angular/coverage/angular/coverage-summary.json",
];

/** vitest json reports, for the passed/failed/skipped counts. */
const REPORTS = [".vitest.json", "frontend/angular/.vitest.json"];

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

let covered = 0;
let total = 0;
for (const path of SUMMARIES) {
  const lines = readJson(path)?.total?.lines;
  if (!lines) continue;
  covered += Number(lines.covered) || 0;
  total += Number(lines.total) || 0;
}

const tests = { passed: 0, failed: 0, skipped: 0 };
let sawReport = false;
for (const path of REPORTS) {
  const report = readJson(path);
  if (!report) continue;
  sawReport = true;
  tests.passed += Number(report.numPassedTests) || 0;
  tests.failed += Number(report.numFailedTests) || 0;
  tests.skipped += Number(report.numPendingTests) || 0;
}

// `total === 0` means nothing was instrumented, which is unknown — not 0%.
const payload =
  total > 0
    ? { pct: (covered / total) * 100, lines: { covered, total } }
    : { pct: null };
if (sawReport) payload.tests = tests;

console.log(
  "::notice title=coverage::MONITOR_COVERAGE " + JSON.stringify(payload),
);
