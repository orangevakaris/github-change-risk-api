# GitHub Change Risk API

`GitHub Change Risk API` returns deterministic, explainable risk signals for a public GitHub compare range. It does not execute repository code, inspect private repositories, or probe deployed targets.

Licensed under [MIT](LICENSE). See [security reporting guidance](SECURITY.md) for private vulnerability reports.

## Current status

The analysis engine and HTTP interface are implemented, tested, and available as a rate-limited preview at [76.13.79.47.nip.io](https://76.13.79.47.nip.io). Production x402 settlement is intentionally not claimed as live yet: it requires a facilitator credential.

## Local use

```bash
npm test
npm start
curl 'http://127.0.0.1:4021/v1/github-risk-delta?repo=owner/repo&base=main&head=feature-branch'
```

## GitHub Action

Run the free summary report from a workflow without an API key:

```yaml
- uses: orangevakaris/github-change-risk-api@v1
  id: change-risk
  with:
    repository: ${{ github.repository }}
    base: ${{ github.event.before }}
    head: ${{ github.sha }}
```

The action writes the score, level, and compact JSON report to outputs and adds a readable report to the workflow summary. Supply the optional `payment-tx` input only after sending a confirmed Base-USDC payment to request the per-file full report.

The preview endpoint has the same routes over HTTPS. It is capped at 30 compare requests per client per minute and is provided for evaluation only while settlement is being configured.

OpenAPI discovery document: `https://76.13.79.47.nip.io/openapi.json`

## Full report payment

The free route returns an aggregate risk summary and a machine-readable `upgrade` object pointing to the paid route. The paid full-report route adds per-file statuses, change counts, and named risk tags:

```text
GET /v1/github-risk-delta/full?repo=OWNER/REPOSITORY&base=REF&head=REF&paymentTx=0x...
```

Send at least `0.01` native USDC on Base to `0x5157E1783c81DA37DAa8Bb490c68b30aB0e9D3A7`, wait for three confirmations, then supply its transaction hash as `paymentTx`. Each transaction pays for one full report and is permanently consumed after a successful delivery. Use `GET /pricing` for machine-readable payment requirements.

Endpoints:

- `GET /health`
- `GET /openapi.json`
- `GET /v1/github-risk-delta?repo=OWNER/REPOSITORY&base=REF&head=REF`

## Output

The response reports changed-file counts, additions/deletions, a 0-100 heuristic score, named path-based signals, and limitations. Signals cover access control, funds and contracts, deployment and CI, dependency manifests, migrations, unusually large changes, and changes with little test-file coverage.

This is triage data, not an audit or security certification. A low score does not establish that a change is safe.

## Planned settlement

The production route will be protected by standard x402 payment middleware on Base USDC and listed through a compatible discovery catalog. That integration is deliberately deferred until its settlement credentials and standalone HTTPS route are available.
