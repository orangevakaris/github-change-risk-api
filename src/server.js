import http from "node:http";
import { appendFileSync, chmodSync, readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
import { analyzeCompare, fullCompareReport } from "./analyze.js";
import { landingHtml } from "./landing.js";
import { createPaymentVerifier, paymentInstructions } from "./payments.js";

const PORT = Number(process.env.PORT || 4021);
const MAX_REQUESTS_PER_MINUTE = Number(process.env.MAX_REQUESTS_PER_MINUTE || 30);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF = /^[A-Za-z0-9._/-]{1,200}$/;
const requestWindows = new Map();
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#16201f"/><path d="M14 18h36v8H22v10h23v8H22v12h-8z" fill="#d7edaa"/><circle cx="50" cy="46" r="6" fill="#d5532f"/></svg>';
const BASE_RPC = "https://mainnet.base.org";
const PAYMENT_STATE_PATH = "/root/.github-change-risk-api-payments.json";
const DELIVERY_LOG_PATH = "/root/.github-change-risk-api-deliveries.jsonl";

function send(response, status, body, headers = {}, headOnly = false) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    ...headers,
  });
  response.end(headOnly ? undefined : JSON.stringify(body, null, 2));
}

function sendHtml(response, status, body, headOnly = false) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'",
    "x-content-type-options": "nosniff",
  });
  response.end(headOnly ? undefined : body);
}

function sendIcon(response, headOnly = false) {
  response.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=604800" });
  response.end(headOnly ? undefined : FAVICON);
}

export function parseCompareRequest(url) {
  const repository = url.searchParams.get("repo") || "";
  const base = url.searchParams.get("base") || "";
  const head = url.searchParams.get("head") || "";
  if (
    !REPOSITORY.test(repository)
    || !REF.test(base)
    || !REF.test(head)
    || base.includes("..")
    || head.includes("..")
  ) {
    return null;
  }
  return { repository, base, head };
}

function isRateLimited(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const key = forwarded || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (requestWindows.get(key) || []).filter((timestamp) => timestamp >= windowStart);
  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    requestWindows.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  requestWindows.set(key, timestamps);
  return false;
}

async function baseRpc(method, params) {
  const response = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "GitHubChangeRiskAPI/0.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Base RPC failed with status ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error("Base RPC returned an error");
  return body.result;
}

function loadConsumedPayments() {
  try {
    const parsed = JSON.parse(readFileSync(PAYMENT_STATE_PATH, "utf8"));
    return Array.isArray(parsed.transactions) ? parsed.transactions.filter((hash) => typeof hash === "string") : [];
  } catch {
    return [];
  }
}

function saveConsumedPayments(transactions) {
  writeFileSync(PAYMENT_STATE_PATH, `${JSON.stringify({ transactions }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(PAYMENT_STATE_PATH, 0o600);
}

function recordDelivery({ repository, base, head, paymentHash }) {
  appendFileSync(
    DELIVERY_LOG_PATH,
    `${JSON.stringify({ deliveredAt: new Date().toISOString(), repository, base, head, paymentHash })}\n`,
    { mode: 0o600 },
  );
  chmodSync(DELIVERY_LOG_PATH, 0o600);
}

const payments = createPaymentVerifier({ rpc: baseRpc, consumed: loadConsumedPayments(), persist: saveConsumedPayments });

async function githubCompare({ repository, base, head }) {
  const compareUrl = new URL(`https://api.github.com/repos/${repository}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
  const response = await fetch(compareUrl, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "GitHubChangeRiskAPI/0.1",
      ...(GITHUB_TOKEN ? { authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub compare request failed with status ${response.status}`);
  }
  const payload = await response.json();
  return {
    ...payload,
    files_truncated: Array.isArray(payload.files) && payload.files.length >= 300,
    requestedBase: base,
    requestedHead: head,
  };
}

const OPENAPI = {
  openapi: "3.1.0",
  info: { title: "GitHub Change Risk API", version: "0.1.0", description: "Deterministic risk signals for public GitHub compare ranges." },
  servers: [{ url: "https://76.13.79.47.nip.io", description: "Rate-limited public preview" }],
  paths: {
    "/v1/github-risk-delta": {
      get: {
        summary: "Analyze a public GitHub compare range",
        parameters: [
          { name: "repo", in: "query", required: true, schema: { type: "string", pattern: "owner/repository" } },
          { name: "base", in: "query", required: true, schema: { type: "string" } },
          { name: "head", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Risk signal report" }, "400": { description: "Invalid request" }, "502": { description: "GitHub comparison unavailable" } },
      },
    },
    "/v1/github-risk-delta/full": {
      get: {
        summary: "Get a paid, per-file public GitHub compare report",
        parameters: [
          { name: "repo", in: "query", required: true, schema: { type: "string", pattern: "owner/repository" } },
          { name: "base", in: "query", required: true, schema: { type: "string" } },
          { name: "head", in: "query", required: true, schema: { type: "string" } },
          { name: "paymentTx", in: "query", required: true, schema: { type: "string", pattern: "0x[a-fA-F0-9]{64}" } },
        ],
        responses: { "200": { description: "Paid full risk report" }, "402": { description: "Base USDC payment required" }, "409": { description: "Payment transaction already used" } },
      },
    },
  },
};

export const server = http.createServer(async (request, response) => {
  const externalProtocol = request.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const externalOrigin = `${externalProtocol}://${request.headers.host || "localhost"}`;
  const url = new URL(request.url || "/", externalOrigin);
  const headOnly = request.method === "HEAD";
  const readMethod = request.method === "GET" || headOnly;
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-max-age": "86400",
    });
    return response.end();
  }
  if (readMethod && url.pathname === "/") {
    return sendHtml(response, 200, landingHtml, headOnly);
  }
  if (readMethod && (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico")) {
    return sendIcon(response, headOnly);
  }
  if (readMethod && url.pathname === "/health") {
    return send(response, 200, { status: "ok", service: "github-change-risk-api" }, {}, headOnly);
  }
  if (readMethod && url.pathname === "/openapi.json") {
    return send(response, 200, OPENAPI, {}, headOnly);
  }
  if (readMethod && url.pathname === "/pricing") {
    return send(response, 200, { fullReport: paymentInstructions() }, {}, headOnly);
  }
  if (request.method !== "GET" || url.pathname !== "/v1/github-risk-delta") {
    if (request.method !== "GET" || url.pathname !== "/v1/github-risk-delta/full") {
      return send(response, 404, { error: "not found" });
    }
  }
  const query = parseCompareRequest(url);
  if (!query) {
    return send(response, 400, { error: "repo, base, and head must identify a public GitHub compare range" });
  }
  if (isRateLimited(request)) {
    return send(response, 429, { error: "rate limit exceeded", retryAfterSeconds: 60 }, { "retry-after": "60" });
  }
  const fullReport = url.pathname === "/v1/github-risk-delta/full";
  if (fullReport) {
    const paymentTx = url.searchParams.get("paymentTx");
    if (!paymentTx) return send(response, 402, { error: "Base USDC payment required", payment: paymentInstructions() });
    let reservation;
    try {
      reservation = await payments.reserve(paymentTx);
    } catch {
      return send(response, 502, { error: "payment verification temporarily unavailable" });
    }
    if (reservation.status === "malformed") return send(response, 400, { error: "paymentTx must be a transaction hash" });
    if (reservation.status === "used" || reservation.status === "pending") return send(response, 409, { error: "payment transaction already used or being processed" });
    if (reservation.status !== "reserved") return send(response, 402, { error: "payment has not been verified and confirmed", payment: paymentInstructions() });
    try {
      const comparison = await githubCompare(query);
      const report = fullCompareReport(comparison);
      recordDelivery({ ...query, paymentHash: reservation.hash });
      payments.consume(reservation.hash);
      return send(response, 200, { repository: query.repository, paid: true, ...report });
    } catch (error) {
      payments.release(reservation.hash);
      return send(response, 502, { error: "comparison unavailable", detail: error.message });
    }
  }
  try {
    const fullEndpoint = new URL("/v1/github-risk-delta/full", externalOrigin);
    fullEndpoint.searchParams.set("repo", query.repository);
    fullEndpoint.searchParams.set("base", query.base);
    fullEndpoint.searchParams.set("head", query.head);
    fullEndpoint.searchParams.set("paymentTx", "0x...");
    return send(response, 200, {
      repository: query.repository,
      ...analyzeCompare(await githubCompare(query)),
      upgrade: {
        fullReportPrice: "0.01 USDC on Base",
        pricing: new URL("/pricing", externalOrigin).toString(),
        fullReport: fullEndpoint.toString(),
      },
    });
  } catch (error) {
    return send(response, 502, { error: "comparison unavailable", detail: error.message });
  }
});

if (process.argv[1] === new URL(import.meta.url).pathname) {
  server.listen(PORT, "127.0.0.1", () => console.log(`GitHub Change Risk API listening on ${PORT}`));
}
