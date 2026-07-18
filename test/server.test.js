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

  const landing = await fetch(`http://127.0.0.1:${port}/`);
  assert.match(landing.headers.get("content-security-policy"), /connect-src 'self'/);
  assert.match(landing.headers.get("content-security-policy"), /script-src 'unsafe-inline'/);

  const robots = await fetch(`http://127.0.0.1:${port}/robots.txt`);
  assert.equal(robots.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(await robots.text(), /Disallow: \/v1\//);

  const sitemap = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
  assert.equal(sitemap.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.match(await sitemap.text(), /76\.13\.79\.47\.sslip\.io/);

  const pricing = await fetch(`http://127.0.0.1:${port}/pricing`);
  const pricingPayload = await pricing.json();
  assert.equal(pricingPayload.fullReport.minimumAmount, "0.01 USDC");
  assert.equal(pricingPayload.fullReport.nativeEth.minimumAmount, "0.00001 ETH");

  const unpaidFullReport = await fetch(`http://127.0.0.1:${port}/v1/github-risk-delta/full?repo=octocat/Hello-World&base=master&head=master`);
  assert.equal(unpaidFullReport.status, 402);
  assert.equal((await unpaidFullReport.json()).error, "Base USDC or ETH payment required");

  const preflight = await fetch(`http://127.0.0.1:${port}/v1/github-risk-delta`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");

  const event = await fetch(`http://127.0.0.1:${port}/v1/events/preview-ready`, { method: "POST" });
  assert.equal(event.status, 204);
  assert.equal(event.headers.get("cache-control"), "no-store");
});
