import assert from "node:assert/strict";
import test from "node:test";
import { landingHtml } from "../src/landing.js";

test("documents the live API route and preview boundary", () => {
  assert.match(landingHtml, /\/v1\/github-risk-delta\?repo=OWNER\/REPOSITORY/);
  assert.match(landingHtml, /favicon\.svg/);
  assert.match(landingHtml, /rate-limited to 30 requests/);
  assert.match(landingHtml, /not an audit/i);
});
