# GitHub Change Risk API

`GitHub Change Risk API` returns deterministic, explainable risk signals for a public GitHub compare range. It does not execute repository code, inspect private repositories, or probe deployed targets.

## Current status

The analysis engine and HTTP interface are implemented and tested locally. Production x402 settlement and public deployment are intentionally not claimed as live yet: production settlement requires a facilitator credential and a dedicated HTTPS hostname.

## Local use

```bash
npm test
npm start
curl 'http://127.0.0.1:4021/v1/github-risk-delta?repo=owner/repo&base=main&head=feature-branch'
```

Endpoints:

- `GET /health`
- `GET /openapi.json`
- `GET /v1/github-risk-delta?repo=OWNER/REPOSITORY&base=REF&head=REF`

## Output

The response reports changed-file counts, additions/deletions, a 0-100 heuristic score, named path-based signals, and limitations. Signals cover access control, funds and contracts, deployment and CI, dependency manifests, migrations, unusually large changes, and changes with little test-file coverage.

This is triage data, not an audit or security certification. A low score does not establish that a change is safe.

## Planned settlement

The production route will be protected by standard x402 payment middleware on Base USDC and listed through a compatible discovery catalog. That integration is deliberately deferred until its settlement credentials and standalone HTTPS route are available.
