import assert from "node:assert/strict";
import test from "node:test";
import { parseCompareRequest } from "../src/server.js";

test("accepts a public GitHub comparison", () => {
  const result = parseCompareRequest(new URL("http://localhost/v1/github-risk-delta?repo=octocat/Hello-World&base=main&head=feature/test"));
  assert.deepEqual(result, { repository: "octocat/Hello-World", base: "main", head: "feature/test" });
});

test("rejects malformed repository and refs", () => {
  assert.equal(parseCompareRequest(new URL("http://localhost/?repo=https://example.com&base=main&head=next")), null);
  assert.equal(parseCompareRequest(new URL("http://localhost/?repo=owner/repo&base=..&head=next")), null);
});
