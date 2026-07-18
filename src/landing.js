export const landingHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Deterministic risk signals for public GitHub compare ranges.">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <title>GitHub Change Risk API</title>
    <style>
      :root { --ink: #16201f; --paper: #f4f0e5; --accent: #d5532f; --line: #3f514e; --muted: #687570; }
      * { box-sizing: border-box; }
      body { background: radial-gradient(circle at 90% 0%, #d7edaa, transparent 26rem), var(--paper); color: var(--ink); font-family: Georgia, serif; margin: 0; }
      main { margin: 0 auto; max-width: 960px; padding: 28px 20px 64px; }
      header { border-bottom: 2px solid var(--ink); display: flex; font-family: monospace; font-size: 12px; justify-content: space-between; letter-spacing: .08em; padding-bottom: 14px; text-transform: uppercase; }
      h1 { font-size: clamp(3rem, 8vw, 6rem); font-weight: 400; letter-spacing: -.07em; line-height: .84; margin: 68px 0 28px; max-width: 720px; }
      h1 span { color: var(--accent); }
      .lede { border-left: 2px solid var(--ink); font-size: 1.25rem; line-height: 1.4; margin: 0 0 54px; max-width: 700px; padding-left: 18px; }
      .grid { border-top: 2px solid var(--ink); display: grid; grid-template-columns: repeat(3, 1fr); }
      section { border-bottom: 1px solid var(--line); min-height: 230px; padding: 22px; }
      section + section { border-left: 1px solid var(--line); }
      h2 { font-size: 1.45rem; font-weight: 400; line-height: 1; margin: 20px 0 14px; }
      p, li { line-height: 1.48; }
      .tag { color: var(--muted); font-family: monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
      .call { background: var(--ink); color: var(--paper); margin-top: 48px; padding: 24px; }
      code { background: rgba(22, 32, 31, .1); font-family: monospace; font-size: .82rem; overflow-wrap: anywhere; padding: 3px 5px; }
      .call code { background: #293734; color: #dcf5ad; display: block; line-height: 1.5; margin-top: 12px; padding: 12px; white-space: pre-wrap; }
      a { color: var(--accent); font-weight: 700; }
      .try-form { display: grid; gap: 12px; grid-template-columns: 2fr 1fr 1fr auto; margin-top: 18px; }
      label { color: var(--muted); display: grid; font-family: monospace; font-size: 11px; gap: 6px; letter-spacing: .08em; text-transform: uppercase; }
      input { background: #fbf8f0; border: 1px solid var(--line); border-radius: 0; color: var(--ink); font: inherit; min-width: 0; padding: 10px; }
      button { align-self: end; background: var(--accent); border: 1px solid var(--accent); color: #fff9ed; cursor: pointer; font: 700 12px monospace; letter-spacing: .06em; min-height: 40px; padding: 10px 14px; text-transform: uppercase; }
      button:focus-visible, input:focus-visible, a:focus-visible { outline: 3px solid #dcf5ad; outline-offset: 3px; }
      button:disabled { cursor: wait; opacity: .7; }
      .result-status { font-family: monospace; font-size: .82rem; line-height: 1.5; margin: 14px 0 0; }
      .result { background: #293734; color: #dcf5ad; font: .78rem/1.5 monospace; margin: 12px 0 0; max-height: 420px; overflow: auto; padding: 14px; white-space: pre-wrap; }
      .unlock { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 18px; }
      .unlock-form { display: grid; gap: 12px; grid-template-columns: 1fr auto; margin-top: 12px; }
      .payment-link { display: inline-block; margin-top: 4px; }
      footer { color: var(--muted); font-family: monospace; font-size: 11px; line-height: 1.6; padding-top: 28px; }
      @media (max-width: 700px) { header { align-items: flex-start; flex-direction: column; gap: 8px; } .grid, .try-form, .unlock-form { grid-template-columns: 1fr; } section + section { border-left: 0; border-top: 1px solid var(--line); } section { min-height: auto; } }
    </style>
  </head>
  <body>
    <main>
      <header><span>GitHub Change Risk API</span><span>Public preview / read-only</span></header>
      <h1>Change the code.<br><span>See the risk.</span></h1>
      <p class="lede">Deterministic, explainable risk signals for a public GitHub compare range. It reads public change metadata and diff content only: no repository execution, private access, or live-target probing.</p>
      <div class="grid">
        <section><div class="tag">01 / output</div><h2>Useful triage data.</h2><p>Scores and names signals around access control, funds and contracts, deployment, dependencies, migrations, CI, change size, test coverage, and review-sensitive diff patterns.</p></section>
        <section><div class="tag">02 / boundary</div><h2>Not an audit.</h2><p>A low score does not mean safe. This is a fast, path-and-diff based starting point for review, not a security certification.</p></section>
        <section><div class="tag">03 / access</div><h2>Preview is open.</h2><p>Public GitHub comparisons only. The summary preview is rate-limited to 30 requests per client per minute. Full per-file reports are available for 0.01 USDC on Base.</p></section>
      </div>
      <section class="call"><div class="tag">Try it</div><h2>Compare two public refs.</h2><p>Enter a public repository and two refs to get an aggregate preview. Nothing is cloned or executed.</p><form class="try-form" id="compare-form"><label>Repository<input id="repository" name="repository" placeholder="owner/repository" pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" required></label><label>Base ref<input id="base" name="base" placeholder="main" pattern="[A-Za-z0-9._/-]{1,200}" required></label><label>Head ref<input id="head" name="head" placeholder="feature-branch" pattern="[A-Za-z0-9._/-]{1,200}" required></label><button id="compare-button" type="submit">Analyze</button></form><p class="result-status" id="result-status" aria-live="polite">Free preview. Public repositories only.</p><pre class="result" id="result" hidden></pre><div class="unlock" id="unlock" hidden><div class="tag">Per-file report / 0.01 USDC</div><p>1. <a class="payment-link" id="payment-link" href="#">Send the exact Base-USDC payment</a> in a compatible wallet. 2. Wait for three confirmations. 3. Paste that transaction hash below.</p><form class="unlock-form" id="full-form"><label>Confirmed transaction hash<input id="payment-tx" name="payment-tx" placeholder="0x..." pattern="0x[a-fA-F0-9]{64}" required></label><button id="full-button" type="submit">Unlock report</button></form></div><code>GET /v1/github-risk-delta?repo=OWNER/REPOSITORY&amp;base=REF&amp;head=REF</code><p><a href="/openapi.json">OpenAPI document</a> · <a href="https://github.com/orangevakaris/github-change-risk-api">Source and limits</a></p></section>
      <section class="call"><div class="tag">Full report / 0.01 USDC</div><h2>Get per-file review cues.</h2><p>Send at least 0.01 native USDC on Base to <code>0x5157E1783c81DA37DAa8Bb490c68b30aB0e9D3A7</code>. <a href="ethereum:0x833589fCD6EDb6E08f4c7C32D4f71b54bda02913@8453/transfer?address=0x5157E1783c81DA37DAa8Bb490c68b30aB0e9D3A7&amp;uint256=10000">Open a pre-filled USDC transfer</a> in a compatible wallet and confirm the destination. After three confirmations, add the transaction hash as <code>paymentTx</code> to the full-report route. One payment funds one report.</p><code>GET /v1/github-risk-delta/full?repo=OWNER/REPOSITORY&amp;base=REF&amp;head=REF&amp;paymentTx=0x...</code><p><a href="/pricing">Payment requirements</a></p></section>
      <footer>Preview endpoint. Output is deterministic and explainable; it is not investment, security, or compliance advice.</footer>
    </main>
    <script>
      const form = document.querySelector("#compare-form");
      const button = document.querySelector("#compare-button");
      const fullForm = document.querySelector("#full-form");
      const fullButton = document.querySelector("#full-button");
      const unlock = document.querySelector("#unlock");
      const paymentLink = document.querySelector("#payment-link");
      const status = document.querySelector("#result-status");
      const result = document.querySelector("#result");
      let activeParams;
      function showReport(payload) {
        result.textContent = JSON.stringify({ comparison: payload.comparison, risk: payload.risk, files: payload.files, limitations: payload.limitations }, null, 2);
        result.hidden = false;
      }
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const params = new URLSearchParams({
          repo: values.get("repository").trim(),
          base: values.get("base").trim(),
          head: values.get("head").trim(),
        });
        button.disabled = true;
        result.hidden = true;
        status.textContent = "Analyzing the public compare range...";
        try {
          const response = await fetch("/v1/github-risk-delta?" + params);
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Preview request failed");
          activeParams = params;
          showReport(payload);
          paymentLink.href = payload.upgrade.payment.paymentLink;
          unlock.hidden = false;
          status.textContent = "Preview ready. Use the connected payment and unlock flow below for the per-file report.";
        } catch (error) {
          status.textContent = "Preview unavailable: " + error.message;
        } finally {
          button.disabled = false;
        }
      });
      fullForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!activeParams) return;
        const params = new URLSearchParams(activeParams);
        params.set("paymentTx", new FormData(fullForm).get("payment-tx").trim());
        fullButton.disabled = true;
        status.textContent = "Verifying the Base-USDC payment and preparing the full report...";
        try {
          const response = await fetch("/v1/github-risk-delta/full?" + params);
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Full report request failed");
          showReport(payload);
          status.textContent = "Per-file report ready.";
        } catch (error) {
          status.textContent = "Full report unavailable: " + error.message;
        } finally {
          fullButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
