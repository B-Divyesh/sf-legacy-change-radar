# Independent verification — FAIL

**Candidate:** `2e4ea3accbb9a5e2bbae63476fe3b0b07df1f96a`  
**Live URL:** https://legacy-change-radar.sociobot.in  
**Verified:** 2026-08-28 (UTC)  
**Verdict:** **FAIL — do not release.**

The production deployment is serving this candidate: the local production
`index-2J64tH4H.js` SHA-256 is
`fe092b6e286387154cb258044adc69051fdf8284aacea63d14e0f1b6eb247a79`
and its CSS SHA-256 is
`b01e6e2dc10d4324f9aed64d80a4c0f4404d56fd32eb8c5169698c19dd6699c1`;
both exactly match the deployed assets. This is not a deployment-only stale
build issue.

## Cold first read

On a fresh desktop browser the first screen says: “Map change risk before code
review”; identifies “maintainers reviewing agent-authored changes in large,
established applications”; and provides **Try it with sample data** with the
nearby explanation “See a real risk card in one click.” It satisfies the
plain-words and one-click-demo first-read requirement.

## Required claim tests — failed from the clean clone

After `npm ci`, before any build, I ran every exact command in
`.factory/claims.json` individually. All four failed, so the required claim
gate fails.

| Claim | Exact command | Clean-clone result | Follow-up diagnostic |
| --- | --- | --- | --- |
| `risk-card` | `npm run test:e2e -- --grep @claim:risk-card` | **FAIL**: `spawnSync /work/repo/target/debug/legacy-change-radar ENOENT` | Passes only after the undeclared prerequisite `cargo build`. |
| `local-private` | `npm run test:e2e -- --grep @claim:local-private` | **FAIL**: the preview has no built `dist/site`, so `/demo` is blank and the required demo banner never appears. | Passes after `npm run build`. |
| `one-click-demo` | `npm run test:e2e -- --grep @claim:one-click-demo` | **FAIL**: the preview has no built site; the browser test times out on the blank page. | Passes after `npm run build`. |
| `team-pack` | `npm run test:e2e -- --grep @claim:team-pack` | **FAIL**: the preview has no built site, so the price/license controls do not render. | Passes after `npm run build` with its mocked verification response. |

The claim commands must be self-contained from a clean checkout. The existing
`playwright.config.ts` starts `vite preview`, which does not build the site,
and the risk-card test invokes a debug binary that neither `cargo test` nor the
claim command builds. This also makes `npm test` fail from the clean checkout:
after its Rust and site checks it has 1 failed / 8 passed Playwright tests, with
the same missing-binary error.

## Defects

### Critical / release-blocking

1. **Claim gate cannot run from a clean clone.** All four required claim
   commands fail as documented above. The acceptance contract explicitly makes
   any failed claim test release-blocking.

2. **The paid checkout is dead.** The visible “Buy Team pack — hosted checkout”
   target, `https://api.sociobot.in/api/v1/products/legacy-change-radar/checkout`,
   returned HTTP **404** on 2026-08-28 with
   `{"error":"enabled factory product","status":404}`. This contradicts the
   live paid-feature claim and leaves a user unable to buy the advertised pack.
   The verify endpoint itself returns the expected 200 invalid-license response,
   so this is specifically a broken checkout/product registration path.

3. **Mobile Axe serious accessibility violations.** On the live home page at
   390×844, Axe 4.10.2 reports `scrollable-region-focusable` (serious,
   WCAG 2.1.1/2.1.3) for `.terminal > pre` and `.command-block > pre`.
   Both can scroll horizontally on mobile but neither is focusable, so keyboard
   users cannot access their overflowed content. Desktop and the other tested
   routes had no serious/critical Axe findings.

### High

4. **The claims inventory does not cover every visitor-facing promise.**
   “Every edge includes evidence and a reason” and “The free CLI needs Rust
   1.85 or newer” appear in landing copy/README but have no corresponding
   `claims.json` entry and sandbox assertion. The claims contract requires an
   entry and observable test for each such promise, or removal of the promise.

### Medium

5. **Hashed static assets are not cached immutably.** The live JS and CSS both
   return `cache-control: public, must-revalidate, max-age=30`, rather than
   long-lived immutable caching. This misses the static-product caching policy
   and causes unnecessary repeat downloads.

6. **Unknown URLs respond with HTTP 200.**
   `https://legacy-change-radar.sociobot.in/missing-specimen` displays a styled
   in-app not-found view but returns 200. `staticwebapp.config.json` has no
   404 `responseOverrides` rule, contrary to the required real 404 response.

## What passed

- `npm ci` completed with zero reported vulnerabilities.
- Exact production build: `npm run build` passed. Built first-load assets are
  7.41 KB gzip JavaScript and 3.89 KB gzip CSS, under budget.
- `cargo test` passed (4 tests); `npm run test:site` passed (2 tests);
  `cargo clippy --all-targets --all-features -- -D warnings` passed.
- After explicitly building the binary/site, the CLI normal JSON scan, bundled
  `demo`, invalid `--format xml` (exit 2), and missing diff recovery (exit 2)
  worked. `cargo package --allow-dirty` passed. A clean consumer installation
  from the generated `.crate` also ran `legacy-change-radar demo --format json`
  successfully and produced the expected three-file migration report.
- Live `/`, `/demo`, `/privacy`, `/terms`, and `/demo.cast` loaded with no
  console/page errors. `verify-url.sh` passed: title, `lang=en`, one h1, main,
  and image alt coverage were present.
- At both desktop and 390px widths, all tested routes had zero page horizontal
  overflow. Keyboard navigation focused the skip link with a visible 3px
  outline and moved focus to the new h1 after navigation. Reduced-motion mode
  produced no running animations.
- A fresh live browser made no external request for the demo and the demo
  wrote no `demo:` local-storage keys. The service worker successfully served
  `/demo` offline after one controlled online reload.
- The Sociobot verify endpoint is rate limited: a rapid 60-request burst began
  returning HTTP 429 with `Retry-After: 4`; a subsequent still-window sequential
  probe first returned 429 on request 4 (so the clean-window threshold could
  not be isolated after the initial burst). This satisfies the required
  back-pressure behavior.

## Reproduction commands

```sh
npm ci
npm run test:e2e -- --grep @claim:risk-card
npm run test:e2e -- --grep @claim:local-private
npm run test:e2e -- --grep @claim:one-click-demo
npm run test:e2e -- --grep @claim:team-pack
npm run build
cargo test
npm run test:site
npm run test:e2e
curl -i https://api.sociobot.in/api/v1/products/legacy-change-radar/checkout
```

No product code was changed during this verification.
