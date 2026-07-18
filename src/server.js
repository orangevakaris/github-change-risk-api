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

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(response, status, body) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
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
  if (request.method === "GET" && url.pathname === "/") {
    return sendHtml(response, 200, landingHtml);
  }
  if (request.method === "GET" && url.pathname === "/health") {
    return send(response, 200, { status: "ok", service: "github-change-risk-api" });
  }
  if (request.method === "GET" && url.pathname === "/openapi.json") {
    return send(response, 200, OPENAPI);
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
