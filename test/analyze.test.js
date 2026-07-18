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
    files: [{ filename: "src/auth/session.js", status: "modified", additions: 4, deletions: 1, changes: 5, patch: "- requireAuth(request)" }],
  });
  assert.deepEqual(report.files, [{
    filename: "src/auth/session.js",
    status: "modified",
    additions: 4,
    deletions: 1,
    changes: 5,
    riskTags: ["auth-access", "auth-control-removed"],
    diffSignals: [{ id: "auth-control-removed", direction: "removed", matchingLines: 1 }],
  }]);
});

test("adds explainable signals for risky diff content", () => {
  const report = fullCompareReport({
    files: [
      { filename: ".github/workflows/release.yml", patch: "+ pull_request_target:\n+ permissions: write-all" },
      { filename: "src/run.js", patch: "+ exec(input)" },
      { filename: "package.json", patch: "+ \"postinstall\": \"node setup.js\"" },
      { filename: "contracts/Vault.sol", patch: "+ target.delegatecall(data);" },
      { filename: "test/behavior.test.js", patch: "- expect(response.status).toBe(401)" },
    ],
  });
  assert.deepEqual(report.risk.signals.map((signal) => signal.id), [
    "deployment",
    "ci",
    "privileged-ci-context",
    "unsafe-command-execution",
    "dependency",
    "dependency-lifecycle-script",
    "funds-contracts",
    "privileged-contract-operation",
    "test-case-removed",
  ]);
  assert.deepEqual(report.files[0].diffSignals, [{ id: "privileged-ci-context", direction: "added", matchingLines: 2 }]);
  assert.deepEqual(report.files[4].riskTags, ["test-case-removed"]);
});
