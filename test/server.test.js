import assert from "node:assert/strict";
import test from "node:test";
import { parseCompareRequest, server } from "../src/server.js";

test("accepts a public GitHub comparison", () => {
  const result = parseCompareRequest(new URL("http://localhost/v1/github-risk-delta?repo=octocat/Hello-World&base=main&head=feature/test"));
  assert.deepEqual(result, { repository: "octocat/Hello-World", base: "main", head: "feature/test" });
});

test("rejects malformed repository and refs", () => {
  assert.equal(parseCompareRequest(new URL("http://localhost/?repo=https://example.com&base=main&head=next")), null);
  assert.equal(parseCompareRequest(new URL("http://localhost/?repo=owner/repo&base=..&head=next")), null);
});

test("allows browser reads on public routes", async (context) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.headers.get("access-control-allow-origin"), "*");

  const preflight = await fetch(`http://127.0.0.1:${port}/v1/github-risk-delta`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
});
