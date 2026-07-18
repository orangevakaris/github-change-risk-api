# GitHub Change Risk API

`GitHub Change Risk API` returns deterministic, explainable path- and diff-content risk signals for a public GitHub compare range. It does not execute repository code, inspect private repositories, or probe deployed targets.

Licensed under [MIT](LICENSE). See [security reporting guidance](SECURITY.md) for private vulnerability reports.

## Current status

The analysis engine and HTTP interface are implemented, tested, and available as a rate-limited preview at [76.13.79.47.nip.io](https://76.13.79.47.nip.io). Per-file full reports are payable now through verified native-USDC or native-ETH transfers on Base.

## Local use

```bash
npm test
npm start
curl 'http://127.0.0.1:4021/v1/github-risk-delta?repo=owner/repo&base=main&head=feature-branch'
```

## GitHub Action

Run the free summary report from a workflow without an API key:

```yaml
- uses: orangevakaris/github-change-risk@v1
  id: change-risk
  with:
    repository: ${{ github.repository }}
    base: ${{ github.event.before }}
    head: ${{ github.sha }}
```

The action writes the score, level, compact JSON report, and prefilled `checkout-url` to outputs and adds a readable report to the workflow summary. Supply the optional `payment-tx` input only after sending a confirmed Base USDC or ETH payment to request the per-file full report.

The preview endpoint has the same routes over HTTPS. It supports browser reads with permissive CORS, is capped at 30 compare requests per client per minute, and provides an aggregate report; the paid route returns the per-file report.

OpenAPI discovery document: `https://76.13.79.47.nip.io/openapi.json`

## Full report payment

The free route returns an aggregate risk summary and a machine-readable `upgrade` object pointing to the paid route and pre-filled wallet transfer. The landing page connects this payment and transaction-hash flow to the selected comparison. The paid full-report route adds per-file statuses, change counts, named risk tags, and counts of matching diff-content cues:

```text
GET /v1/github-risk-delta/full?repo=OWNER/REPOSITORY&base=REF&head=REF&paymentTx=0x...
```

Send at least `0.01` native USDC or `0.00001` native ETH on Base to `0x5157E1783c81DA37DAa8Bb490c68b30aB0e9D3A7`, wait for three confirmations, then supply its transaction hash as `paymentTx`. Wallets that support payment links can use this [pre-filled Base-USDC transfer](ethereum:0x833589fCD6EDb6E08f4c7c32d4f71b54bda02913@8453/transfer?address=0x5157E1783c81DA37DAa8Bb490c68b30aB0e9D3A7&uint256=10000) or [pre-filled Base-ETH transfer](ethereum:0x5157e1783c81da37daa8bb490c68b30ab0e9d3a7@8453?value=1e13). Each transaction pays for one full report and is permanently consumed after a successful delivery. Use `GET /pricing` for machine-readable payment requirements.

Endpoints:

- `GET /health`
- `GET /openapi.json`
- `GET /v1/github-risk-delta?repo=OWNER/REPOSITORY&base=REF&head=REF`

## Output

The response reports changed-file counts, additions/deletions, a 0-100 heuristic score, named path- and diff-content signals, and limitations. Signals cover access control, funds and contracts, deployment and CI, dependency manifests, migrations, unusually large changes, changes with little test-file coverage, removed authorization guards, privileged CI configuration, command-execution primitives, dependency lifecycle scripts, privileged smart-contract operations, and removed tests.

This is triage data, not an audit or security certification. A low score does not establish that a change is safe.

## Minimal funnel telemetry

The landing page posts `preview-ready` and `payment-intent` event names to the same origin for aggregate operational counts. The event payloads do not include repository names, refs, transaction hashes, wallet addresses, or browser identifiers.

## Payment protocol status

The direct Base USDC and ETH route described above is the current production payment path. Successful paid responses include `paymentAsset` (`usdc` or `eth`) and the local delivery log records the same value. The API does not currently advertise x402 compatibility; any future payment-protocol integration will be documented only after it is deployed and verified.
