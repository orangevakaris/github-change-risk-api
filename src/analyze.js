const RULES = [
  {
    id: "auth-access",
    label: "Authentication or authorization path changed",
    pattern: /(^|\/)(auth|authorization|oauth|session|jwt|rbac|permission|role|access|middleware)([._/-]|$)/i,
    weight: 24,
  },
  {
    id: "funds-contracts",
    label: "Funds, wallet, or smart-contract path changed",
    pattern: /(^|\/)(payment|billing|wallet|escrow|token|vault|contract|solidity)([._/-]|$)/i,
    weight: 22,
  },
  {
    id: "deployment",
    label: "Deployment or infrastructure configuration changed",
    pattern: /(^|\/)(\.github\/workflows|dockerfile|docker-compose|terraform|k8s|kubernetes|helm|deploy|infra)([._/-]|$)/i,
    weight: 18,
  },
  {
    id: "dependency",
    label: "Dependency manifest or lockfile changed",
    pattern: /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements.*\.txt|poetry\.lock|pyproject\.toml|go\.mod|cargo\.toml)([._/-]|$)/i,
    weight: 14,
  },
  {
    id: "database",
    label: "Schema or data migration changed",
    pattern: /(^|\/)(migration|schema|database|prisma|sql)([._/-]|$)/i,
    weight: 13,
  },
  {
    id: "ci",
    label: "Continuous integration configuration changed",
    pattern: /(^|\/)(\.github\/workflows|\.gitlab-ci|jenkinsfile|circleci)([._/-]|$)/i,
    weight: 10,
  },
];

const DIFF_RULES = [
  {
    id: "auth-control-removed",
    label: "Authentication or authorization guard removed",
    direction: "removed",
    pattern: /\b(requireAuth|requireRole|authorize|isAdmin|verifyToken|checkPermission|enforcePermission)\b/i,
    weight: 30,
  },
  {
    id: "privileged-ci-context",
    label: "Privileged CI trigger or permission added",
    direction: "added",
    pattern: /\bpull_request_target\b|\bpermissions\s*:\s*write-all\b|\b(?:contents|pull-requests|actions|packages|id-token)\s*:\s*write\b/i,
    weight: 28,
  },
  {
    id: "unsafe-command-execution",
    label: "Potential command execution primitive added",
    direction: "added",
    pattern: /\b(?:eval|exec|execSync|spawn|spawnSync|system|popen)\s*\(|\bshell\s*:\s*true\b|\bshell\s*=\s*True\b/i,
    weight: 20,
  },
  {
    id: "dependency-lifecycle-script",
    label: "Dependency lifecycle script added",
    direction: "added",
    pattern: /"(?:preinstall|install|postinstall|prepublishOnly)"\s*:/i,
    weight: 16,
  },
  {
    id: "privileged-contract-operation",
    label: "Sensitive smart-contract operation added",
    direction: "added",
    pattern: /\b(?:delegatecall|selfdestruct|transferOwnership|setOwner|grantRole|upgradeTo(?:AndCall)?)\b/i,
    weight: 24,
  },
  {
    id: "test-case-removed",
    label: "Test case or assertion removed",
    direction: "removed",
    pattern: /\b(?:test|it|expect|assert|should)\s*[.(]/i,
    weight: 10,
  },
];

const TEST_PATH = /(^|\/)(__tests__|test|tests|spec|specs)(\/|$)|\.(test|spec)\.[^.]+$/i;

function changedPatchLines(file, direction) {
  const prefix = direction === "added" ? "+" : "-";
  const header = direction === "added" ? "+++" : "---";
  return String(file.patch || "")
    .split("\n")
    .filter((line) => line.startsWith(prefix) && !line.startsWith(header));
}

function matchingDiffRules(file) {
  return DIFF_RULES.filter((rule) => changedPatchLines(file, rule.direction).some((line) => rule.pattern.test(line)));
}

function uniqueSignals(files) {
  const signals = new Map();
  for (const file of files) {
    const filename = String(file.filename || "");
    for (const rule of RULES) {
      if (!rule.pattern.test(filename)) continue;
      const existing = signals.get(rule.id) || { ...rule, files: [] };
      existing.files.push(filename);
      signals.set(rule.id, existing);
    }
    for (const rule of matchingDiffRules(file)) {
      const existing = signals.get(rule.id) || { ...rule, files: [] };
      existing.files.push(filename);
      signals.set(rule.id, existing);
    }
  }
  return [...signals.values()].map(({ id, label, weight, files }) => ({
    id,
    label,
    weight,
    files: [...new Set(files)].sort(),
  }));
}

export function fileRiskTags(filename, patch = "") {
  return [
    ...RULES.filter((rule) => rule.pattern.test(String(filename || ""))).map((rule) => rule.id),
    ...matchingDiffRules({ patch }).map((rule) => rule.id),
  ];
}

function fileDiffSignals(file) {
  return matchingDiffRules(file).map((rule) => ({
    id: rule.id,
    direction: rule.direction,
    matchingLines: changedPatchLines(file, rule.direction).filter((line) => rule.pattern.test(line)).length,
  }));
}

export function analyzeCompare(compare) {
  const files = Array.isArray(compare.files) ? compare.files : [];
  const signals = uniqueSignals(files);
  const changedFiles = files.map((file) => String(file.filename || "")).filter(Boolean);
  const testFiles = changedFiles.filter((filename) => TEST_PATH.test(filename));
  const sourceFiles = changedFiles.filter((filename) => !TEST_PATH.test(filename));
  const totalChanges = files.reduce(
    (sum, file) => sum + Number(file.additions || 0) + Number(file.deletions || 0),
    0,
  );
  const coverageRatio = sourceFiles.length === 0 ? 1 : testFiles.length / sourceFiles.length;
  const sizeWeight = totalChanges > 1000 ? 18 : totalChanges > 300 ? 10 : totalChanges > 80 ? 5 : 0;
  const testWeight = sourceFiles.length >= 3 && coverageRatio < 0.2 ? 12 : 0;
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0) + sizeWeight + testWeight);

  return {
    comparison: {
      base: compare.base_commit?.sha || compare.requestedBase || null,
      head: compare.commits?.at(-1)?.sha || compare.requestedHead || null,
      totalCommits: Number(compare.total_commits || 0),
      filesChanged: changedFiles.length,
      additions: files.reduce((sum, file) => sum + Number(file.additions || 0), 0),
      deletions: files.reduce((sum, file) => sum + Number(file.deletions || 0), 0),
      filesTruncated: Boolean(compare.files_truncated),
    },
    risk: {
      score,
      level: score >= 55 ? "high" : score >= 25 ? "medium" : "low",
      signals,
      sizeWeight,
      testCoverageSignal: testWeight > 0 ? "Low test-file coverage relative to changed source files." : null,
    },
    limitations: [
      "Signals are deterministic path- and diff-content review cues, not a security audit.",
      "The API does not execute repository code or probe deployed targets.",
      "A low score does not establish that a change is safe.",
    ],
  };
}

export function fullCompareReport(compare) {
  return {
    ...analyzeCompare(compare),
    files: (Array.isArray(compare.files) ? compare.files : []).map((file) => ({
      filename: String(file.filename || ""),
      status: String(file.status || "unknown"),
      additions: Number(file.additions || 0),
      deletions: Number(file.deletions || 0),
      changes: Number(file.changes || 0),
      riskTags: fileRiskTags(file.filename, file.patch),
      diffSignals: fileDiffSignals(file),
    })),
  };
}
