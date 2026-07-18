import http from "node:http";
import { URL } from "node:url";
import { analyzeCompare } from "./analyze.js";
import { landingHtml } from "./landing.js";

const PORT = Number(process.env.PORT || 4021);
const MAX_REQUESTS_PER_MINUTE = Number(process.env.MAX_REQUESTS_PER_MINUTE || 30);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF = /^[A-Za-z0-9._/-]{1,200}$/;
const requestWindows = new Map();
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#16201f"/><path d="M14 18h36v8H22v10h23v8H22v12h-8z" fill="#d7edaa"/><circle cx="50" cy="46" r="6" fill="#d5532f"/></svg>';

function send(response, status, body, headers = {}, headOnly = false) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(headOnly ? undefined : JSON.stringify(body, null, 2));
}

function sendHtml(response, status, body, headOnly = false) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
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
  },
};

export const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const headOnly = request.method === "HEAD";
  const readMethod = request.method === "GET" || headOnly;
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
  if (request.method !== "GET" || url.pathname !== "/v1/github-risk-delta") {
    return send(response, 404, { error: "not found" });
  }
  const query = parseCompareRequest(url);
  if (!query) {
    return send(response, 400, { error: "repo, base, and head must identify a public GitHub compare range" });
  }
  if (isRateLimited(request)) {
    return send(response, 429, { error: "rate limit exceeded", retryAfterSeconds: 60 }, { "retry-after": "60" });
  }
  try {
    return send(response, 200, { repository: query.repository, ...analyzeCompare(await githubCompare(query)) });
  } catch (error) {
    return send(response, 502, { error: "comparison unavailable", detail: error.message });
  }
});

if (process.argv[1] === new URL(import.meta.url).pathname) {
  server.listen(PORT, "127.0.0.1", () => console.log(`GitHub Change Risk API listening on ${PORT}`));
}
