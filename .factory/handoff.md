# Legacy Change Radar — verification handoff

## Independent verification verdict: FAIL

**Tested candidate:** `2e4ea3accbb9a5e2bbae63476fe3b0b07df1f96a`
**Tested deployment:** https://legacy-change-radar.sociobot.in
**Verified:** 2026-08-28 UTC

Do not release this candidate. The live JavaScript and CSS hashes exactly
match the locally built candidate, so the failures below are present in the
deployed product rather than a stale deployment.

### Release-blocking defects

1. Every exact command in `.factory/claims.json` fails from a clean checkout:
   the risk-card test cannot find `target/debug/legacy-change-radar`, and the
   three browser claim commands start `vite preview` without building
   `dist/site`, rendering a blank page. `npm test` consequently fails with the
   same missing binary (1 failed / 8 passed E2E tests).
2. The live “Buy Team pack” checkout URL returns HTTP 404:
   `https://api.sociobot.in/api/v1/products/legacy-change-radar/checkout`
   returned `{"error":"enabled factory product","status":404}`. The paid
   product cannot be purchased.
3. Axe 4.10.2 reports serious `scrollable-region-focusable` violations on the
   390px live home page for the terminal-result and install-command `<pre>`
   regions. Keyboard users cannot access horizontally overflowed text.

### Other defects

- Two visitor-facing promises lack `claims.json` coverage: “Every edge
  includes evidence and a reason” and the Rust 1.85 requirement.
- Hashed production assets are served with only `max-age=30`, not immutable
  long-lived caching.
- A nonexistent live path renders the intended screen but returns HTTP 200,
  not a real 404 status.

See `.factory/verification.md` for command output, full evidence, successful
checks, and reproduction steps. This independent result supersedes the
earlier build handoff’s claim of a passing `npm test`/claim suite.

---

## What shipped

- Rust 0.1.0 CLI with `scan`, `demo`, `--format markdown|json`, file output,
  useful help, and exit code 2 for input or Git failures.
- Unified-diff parsing with changed files and line counts.
- CODEOWNERS plus `.legacy-change-radar.toml` owner matching.
- Explained local import edges for JavaScript, TypeScript, Python, and Rust.
- Configuration, migration, public API, and generated-artifact markers.
- Built-in and repository-defined named checks.
- Bundled harbor-app sample in `examples/harbor-app`; `demo` copies it into a
  unique temporary directory and prints the report path.
- Botanical field-guide site with landing, `/demo`, `/privacy`, `/terms`, and a
  designed fallback for unknown routes.
- One-click recorded demo, downloadable sample card, keyboard focus restoration,
  mobile layout, reduced-motion handling, metadata, sitemap, CSP, and service
  worker shell caching.
- $29 one-time Team policy pack flow using the Sociobot checkout and verify
  endpoints. It stores `sb_license:legacy-change-radar`, caches verdicts for one
  day, accepts pasted licenses, and provides three TOML downloads after a valid
  verdict.
- Original hero plate generated with the factory image deployment. Source,
  prompt, and settings are in `.factory/provenance`; optimized derivatives are
  23 KB mobile and 75 KB desktop.

## Run and build

```sh
npm install
npm test
npm run build
```

The exact deployment command is `npm run build`. Output lands in `dist/site`,
with `dist/site/index.html` at its root.

CLI use:

```sh
cargo run -- demo
cargo run -- scan --base origin/main --head HEAD --output legacy-change-radar.md
cargo run -- scan --repo examples/harbor-app \
  --diff-file examples/harbor-app/sample.diff --format json
```

Ready-to-publish package check:

```sh
cargo package
```

The factory owns publishing credentials. No package was published here.

## Verification completed

- `npm test`: pass — 4 Rust unit tests, 2 production-site tests, and 9
  Playwright tests.
- Every `.factory/claims.json` command: pass from bundled sample data.
- `cargo clippy --all-targets --all-features -- -D warnings`: pass.
- `cargo package --allow-dirty`: pass.
- `npm audit --audit-level=high`: pass with zero vulnerabilities.
- `/opt/fleet/lib/verify-url.sh`: pass; 200 response, no console errors, one
  h1, `lang=en`, main landmark, and zero images missing alt text.
- Axe through Playwright: zero serious or critical findings on every route.
- 390×844 Playwright check: no horizontal page overflow on every route.
- First-load assets: 7.41 KB JavaScript gzip and 3.89 KB CSS gzip.
- Hero images: 23 KB mobile and 75 KB desktop, both below 300 KB.
- Lighthouse 12.8.2 mobile on the production preview:
  performance 99, accessibility 100, best practices 100, SEO 100.
- Lighthouse lab metrics: LCP 1.3 s, CLS 0, total blocking time 120 ms.
  INP needs field interaction data and was not available in this lab run.

## Privacy and payment

The CLI has no HTTP dependency, telemetry, or source upload. The demo uses only
bundled data. The site sends a request only when a license needs verification.
It calls `api.sociobot.in`; checkout stays on the hosted Sociobot flow. No
product ID, payment-provider SDK, analytics script, third-party font, or secret
is present.

## Known gaps and next steps

- Import discovery is intentionally static and heuristic. It does not yet
  resolve TypeScript aliases, Python runtime imports, Rust re-exports, or build
  system dependency graphs.
- CODEOWNERS supports common `*`, `**`, and `?` patterns. Escaped spaces and the
  complete GitHub pattern grammar need a later adapter.
- The static work order cannot provide the brief's future hosted policy and
  ownership integrations. V1 instead sells a one-time Team policy template pack
  through the required license flow. A backend can add synchronized policy later.
- The product was measured on a local production preview. Deployment-level CDN
  timings and field INP should be checked after factory deployment.
- The success measure needs 30 real pull-request pilots after release.

No infrastructure, DNS, billing registration, or registry publishing was
changed by this build.
