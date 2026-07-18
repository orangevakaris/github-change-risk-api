import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCompare } from "../src/analyze.js";

test("scores access, funds, deployment, and large untested changes", () => {
  const report = analyzeCompare({
    total_commits: 4,
    base_commit: { sha: "base" },
    head_commit: { sha: "head" },
    files: [
      { filename: "src/auth/session.js", additions: 120, deletions: 20 },
      { filename: "contracts/escrow.sol", additions: 80, deletions: 0 },
      { filename: ".github/workflows/release.yml", additions: 10, deletions: 2 },
      { filename: "src/api.js", additions: 110, deletions: 0 },
    ],
  });
  assert.equal(report.risk.level, "high");
  assert.deepEqual(report.risk.signals.map((signal) => signal.id), ["auth-access", "funds-contracts", "deployment", "ci"]);
  assert.match(report.risk.testCoverageSignal, /Low test-file coverage/);
});

test("keeps documentation-only changes low risk", () => {
  const report = analyzeCompare({
    files: [{ filename: "docs/usage.md", additions: 12, deletions: 4 }],
  });
  assert.equal(report.risk.score, 0);
  assert.equal(report.risk.level, "low");
  assert.equal(report.risk.signals.length, 0);
});
