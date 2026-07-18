import assert from "node:assert/strict";
import test from "node:test";
import { landingHtml } from "../src/landing.js";

test("documents the live API route and preview boundary", () => {
  assert.match(landingHtml, /\/v1\/github-risk-delta\?repo=OWNER\/REPOSITORY/);
  assert.match(landingHtml, /favicon\.svg/);
  assert.match(landingHtml, /@8453\/transfer\?address=0x5157E1783c81DA37DAa8Bb490c68b30aB0e9D3A7&amp;uint256=10000/);
  assert.match(landingHtml, /rate-limited to 30 requests/);
  assert.match(landingHtml, /not an audit/i);
});
