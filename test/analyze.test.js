import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCompare, fullCompareReport } from "../src/analyze.js";

test("scores access, funds, deployment, and large untested changes", () => {
  const report = analyzeCompare({
    total_commits: 4,
    base_commit: { sha: "base" },
    requestedHead: "head",
    files: [
      { filename: "src/auth/session.js", additions: 120, deletions: 20 },
      { filename: "contracts/escrow.sol", additions: 80, deletions: 0 },
      { filename: ".github/workflows/release.yml", additions: 10, deletions: 2 },
      { filename: "src/api.js", additions: 110, deletions: 0 },
    ],
  });
  assert.equal(report.risk.level, "high");
  assert.equal(report.comparison.head, "head");
  assert.deepEqual(report.risk.signals.map((signal) => signal.id), ["auth-access", "funds-contracts", "deployment", "ci"]);
  assert.match(report.risk.testCoverageSignal, /Low test-file coverage/);
});

test("uses GitHub's final compared commit when it is available", () => {
  const report = analyzeCompare({
    requestedHead: "branch-name",
    commits: [{ sha: "first" }, { sha: "resolved-head" }],
    files: [],
  });
  assert.equal(report.comparison.head, "resolved-head");
});

test("keeps documentation-only changes low risk", () => {
  const report = analyzeCompare({
    files: [{ filename: "docs/usage.md", additions: 12, deletions: 4 }],
  });
  assert.equal(report.risk.score, 0);
  assert.equal(report.risk.level, "low");
  assert.equal(report.risk.signals.length, 0);
});

test("includes per-file risk tags in a full report", () => {
  const report = fullCompareReport({
    files: [{ filename: "src/auth/session.js", status: "modified", additions: 4, deletions: 1, changes: 5 }],
  });
  assert.deepEqual(report.files, [{ filename: "src/auth/session.js", status: "modified", additions: 4, deletions: 1, changes: 5, riskTags: ["auth-access"] }]);
});
