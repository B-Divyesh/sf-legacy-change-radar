import "./style.css";
import { demoLines } from "./demo-cast";

const PRODUCT = "legacy-change-radar";
const LICENSE_KEY = `sb_license:${PRODUCT}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT}`;
const VERIFY_URL = `https://api.sociobot.in/api/v1/products/${PRODUCT}/verify`;
const CHECKOUT_URL = `https://api.sociobot.in/api/v1/products/${PRODUCT}/checkout`;
const DAY = 86_400_000;

type Route = "/" | "/demo" | "/privacy" | "/terms" | "/404";
type Verdict = { valid: boolean; reason: string; checkedAt: number; token: string };

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("App root is missing");
const app: HTMLDivElement = appRoot;

let demoTimer: number | undefined;
let licenseActive = false;

const routeMeta: Record<Route, { title: string; description: string }> = {
  "/": {
    title: "Legacy Change Radar — Map change risk before review",
    description: "Turn a Git diff into a review card with owners, dependency edges, change markers, and named checks.",
  },
  "/demo": {
    title: "Demo — Legacy Change Radar",
    description: "Inspect the real Legacy Change Radar CLI output using its bundled harbor application sample.",
  },
  "/privacy": {
    title: "Privacy — Legacy Change Radar",
    description: "Read what the local CLI and product site store, send, and retain.",
  },
  "/terms": {
    title: "Terms — Legacy Change Radar",
    description: "Read the terms for the free CLI and the one-time Team policy pack purchase.",
  },
  "/404": {
    title: "Page not found — Legacy Change Radar",
    description: "This field-guide page is missing. Return to Legacy Change Radar.",
  },
};

const icon = `<img class="mark" src="/favicon.svg" width="36" height="36" alt="" />`;

function layout(content: string, route: Route, demo = false): string {
  return `
    <a class="skip-link" href="#main">Skip to main content</a>
    <div class="paper-noise" aria-hidden="true"></div>
    ${demo ? demoBanner() : ""}
    <header class="site-header">
      <a class="wordmark" href="/" data-link>${icon}<span>Legacy Change Radar</span></a>
      <nav aria-label="Main navigation">
        <a href="/demo" data-link ${route === "/demo" ? 'aria-current="page"' : ""}>Demo</a>
        <a href="/#install">Install</a>
        <a href="/privacy" data-link ${route === "/privacy" ? 'aria-current="page"' : ""}>Privacy</a>
      </nav>
    </header>
    <main id="main">${content}</main>
    ${footer()}
    <div class="route-announcer" aria-live="polite" aria-atomic="true"></div>
  `;
}

function demoBanner(): string {
  return `
    <aside class="demo-banner" aria-label="Demo mode">
      <span><strong>Demo</strong> — sample data, nothing is saved</span>
      <span class="demo-actions">
        <button class="text-button" type="button" data-reset-demo>Reset demo</button>
        <a href="/#install">Start for real</a>
      </span>
    </aside>
  `;
}

function footer(): string {
  return `
    <footer class="site-footer">
      <div>
        <span class="footer-name">Legacy Change Radar</span>
        <p>Map a code change's owners, dependencies, and review checks.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/privacy" data-link>Privacy</a>
        <a href="/terms" data-link>Terms</a>
        <a href="https://sociobot.in">Built by Param Factory <span aria-hidden="true">↗</span><span class="sr-only"> (external site)</span></a>
      </nav>
      <p class="build-id">Version 0.1.0 · build 2026.08.28</p>
    </footer>
  `;
}

function homePage(): string {
  return `
    <section class="hero section-shell" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="eyebrow">Field note 01 · review context</p>
        <h1 id="page-title" tabindex="-1">Map change risk before code review</h1>
        <p class="lede">For maintainers reviewing agent-authored changes in large, established applications.</p>
        <div class="primary-row">
          <a class="button primary" href="/demo" data-link>Try it with sample data</a>
          <span>See a real risk card in one click.</span>
        </div>
        <ul class="plain-facts" aria-label="Product facts">
          <li>Runs inside your repository.</li>
          <li>No telemetry or source upload.</li>
          <li>Free CLI. Team pack: $29 once.</li>
        </ul>
      </div>
      <figure class="specimen">
        <picture>
          <source media="(max-width: 600px)" srcset="/art/radar-specimen-mobile.webp" />
          <img src="/art/radar-specimen.webp" width="1280" height="853" alt="A pressed fern whose roots form a software dependency map." fetchpriority="high" />
        </picture>
        <figcaption><span>Specimen LCR–01</span> Visible change, traced habitat</figcaption>
      </figure>
    </section>

    <section class="preview-section section-shell" aria-labelledby="preview-title">
      <div class="section-intro">
        <p class="eyebrow">Observed output</p>
        <h2 id="preview-title">Turn a Git diff into a risk card</h2>
        <p>See owners, dependency edges, change markers, and named checks before line-by-line review.</p>
      </div>
      ${terminalPreview()}
    </section>

    <section class="method section-shell" aria-labelledby="method-title">
      <div class="section-intro">
        <p class="eyebrow">Method</p>
        <h2 id="method-title">Trace the change in three steps</h2>
      </div>
      <ol class="method-list">
        <li><span class="method-number">01</span><div><h3>Read the change</h3><p>Give the CLI a revision range or unified diff.</p></div></li>
        <li><span class="method-number">02</span><div><h3>Trace nearby code</h3><p>It matches owners, local imports, paths, and added lines.</p></div></li>
        <li><span class="method-number">03</span><div><h3>Write the appendix</h3><p>It prints Markdown for reviewers or JSON for CI scripts.</p></div></li>
      </ol>
    </section>

    <section class="install-section section-shell" id="install" aria-labelledby="install-title">
      <div class="install-copy">
        <p class="eyebrow">First real step</p>
        <h2 id="install-title">Run it before line-by-line review</h2>
        <p>The free CLI needs Rust 1.85 or newer.</p>
      </div>
      <div class="command-block">
        <button class="copy-button" type="button" data-copy-command aria-label="Copy install command">Copy command</button>
        <pre><code>git clone https://github.com/B-Divyesh/sf-legacy-change-radar.git
cd sf-legacy-change-radar
cargo install --path .
legacy-change-radar scan --base origin/main</code></pre>
        <p class="copy-status" role="status"></p>
      </div>
    </section>

    <section class="limits section-shell" aria-labelledby="limits-title">
      <div>
        <p class="eyebrow">Boundaries</p>
        <h2 id="limits-title">Keep judgment with the reviewer</h2>
      </div>
      <div class="ruled-notes">
        <p><strong>It does not approve code.</strong> A risk card is context, not proof.</p>
        <p><strong>It does not upload source.</strong> Analysis runs in your repository.</p>
        <p><strong>It does not hide inference.</strong> Every edge includes evidence and a reason.</p>
      </div>
    </section>

    <section class="paid-section section-shell" aria-labelledby="paid-title">
      <div class="price-stamp" aria-label="29 US dollars, one time"><span>$29</span><small>one time</small></div>
      <div class="paid-copy">
        <p class="eyebrow">Optional Team policy pack</p>
        <h2 id="paid-title">Start shared review policy faster</h2>
        <p>Get maintained templates for monorepos, database apps, and public APIs.</p>
        <p>The free CLI keeps analysis, Markdown, JSON, and custom rules.</p>
        <a class="button secondary" href="${CHECKOUT_URL}">Buy Team pack — hosted checkout <span aria-hidden="true">↗</span></a>
        <p class="merchant-note">Sociobot is the merchant of record. Refunds revoke the license.</p>
        <form class="license-form" data-license-form>
          <label for="license-token">Have a license? Paste it here.</label>
          <div class="license-row">
            <input id="license-token" name="license" type="password" autocomplete="off" required aria-describedby="license-help license-status" />
            <button class="button quiet" type="submit">Verify license</button>
          </div>
          <p id="license-help" class="field-help">The token stays in this browser and goes only to Sociobot for verification.</p>
          <p id="license-status" class="form-status" role="status"></p>
        </form>
        <div class="team-content" data-team-content hidden>
          <h3>Team policy templates</h3>
          <p>Your license is active. Download any template as TOML.</p>
          <div class="template-actions">
            <button type="button" class="download-link" data-template="monorepo">Download monorepo policy</button>
            <button type="button" class="download-link" data-template="database">Download database policy</button>
            <button type="button" class="download-link" data-template="api">Download public API policy</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function terminalPreview(): string {
  return `
    <figure class="terminal" aria-label="Recorded terminal output from the bundled sample">
      <figcaption>
        <span class="terminal-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>harbor-app / pull request 284</span>
        <span>real sample output</span>
      </figcaption>
      <pre aria-label="Legacy Change Radar sample result"><code><span class="term-command">$ legacy-change-radar demo</span>

<span class="term-heading"># Legacy Change Radar</span>
<span class="term-muted">Source: bundled harbor-app sample</span>

<strong>3 files · +6 additions · −3 deletions</strong>

<span class="term-heading">Review signals</span>
<span class="term-danger">HIGH  migration · migrations/20260828_add_berth_depth.sql</span>
<span class="term-warn">MED   public API · src/routes/berths.ts</span>
<span class="term-warn">MED   configuration · config/harbor.toml</span>

<span class="term-heading">Dependency edges</span>
IN    src/jobs/tide-reminder.ts → src/routes/berths.ts
OUT   src/routes/berths.ts → src/stores/berths.ts

<span class="term-heading">Required named checks</span>
[ ] migration-review   [ ] public-api-contract   [ ] dependent-tests</code></pre>
    </figure>
  `;
}

function demoPage(): string {
  return `
    <section class="demo-head section-shell" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">Bundled harbor-app sample</p>
        <h1 id="page-title" tabindex="-1">Inspect a sample change risk card</h1>
        <p class="lede">The real CLI reads three changed files and traces their nearby risk surfaces.</p>
      </div>
      <div class="demo-controls" aria-label="Demo controls">
        <button class="button quiet" type="button" data-replay-demo>Replay terminal</button>
        <button class="button quiet" type="button" data-download-card>Download sample card</button>
      </div>
    </section>
    <section class="demo-workbench section-shell" aria-labelledby="workbench-title">
      <h2 id="workbench-title" class="sr-only">Recorded CLI result</h2>
      <aside class="sample-files" aria-label="Changed sample files">
        <p class="specimen-label">Changed specimens</p>
        <ul>
          <li><span class="file-state modified">M</span><code>src/routes/berths.ts</code><small>+4 −2</small></li>
          <li><span class="file-state added">A</span><code>migrations/20260828_add_berth_depth.sql</code><small>+1</small></li>
          <li><span class="file-state modified">M</span><code>config/harbor.toml</code><small>+1 −1</small></li>
        </ul>
        <p class="sample-note">Owners: @api-maintainers, @data-platform, @platform-ops</p>
      </aside>
      <figure class="terminal demo-terminal">
        <figcaption>
          <span class="terminal-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>legacy-change-radar demo</span>
          <span data-playback-status>recorded</span>
        </figcaption>
        <pre tabindex="0" aria-label="Animated recording of the real CLI output"><code data-demo-output></code></pre>
      </figure>
    </section>
    <section class="evidence-strip section-shell" aria-labelledby="evidence-title">
      <h2 id="evidence-title">Why each edge appears</h2>
      <dl>
        <div><dt>Inbound</dt><dd><code>tide-reminder.ts</code> imports the changed route.</dd></div>
        <div><dt>Outbound</dt><dd>The changed route imports <code>stores/berths.ts</code>.</dd></div>
        <div><dt>Owner</dt><dd><code>/src/routes/</code> matches the CODEOWNERS rule.</dd></div>
      </dl>
      <p class="notice">This card shows review context. It does not prove that the change is correct.</p>
    </section>
  `;
}

function privacyPage(): string {
  return `
    <article class="prose-page section-shell">
      <p class="eyebrow">Policy · updated 28 August 2026</p>
      <h1 id="page-title" tabindex="-1">See what stays on your device</h1>
      <p class="lede">The CLI and site collect no analytics or advertising data.</p>
      <h2>The CLI</h2>
      <p>The CLI reads the repository, Git revisions, and policy file you name. It makes no network requests. It sends no telemetry.</p>
      <h2>The product site</h2>
      <p>The site works without an account. It does not store sample demo data.</p>
      <p>If you paste a license, the browser stores that token and its latest verdict. The token goes to Sociobot only when verification is due.</p>
      <h2>Checkout</h2>
      <p>The buy link opens Sociobot's hosted checkout. Sociobot and Dodo process the purchase under their own policies.</p>
      <h2>Remove stored data</h2>
      <p>Clear this site's browser storage to remove the license and cached verdict.</p>
      <h2>Questions</h2>
      <p>Email <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>.</p>
    </article>
  `;
}

function termsPage(): string {
  return `
    <article class="prose-page section-shell">
      <p class="eyebrow">Terms · updated 28 August 2026</p>
      <h1 id="page-title" tabindex="-1">Use the radar as review context</h1>
      <p class="lede">These terms cover the free CLI and optional Team policy pack.</p>
      <h2>Free CLI</h2>
      <p>The CLI is licensed under MIT. You may use, copy, change, and distribute it under that license.</p>
      <h2>No correctness promise</h2>
      <p>The report is an aid for human review. It can miss owners, edges, markers, and required checks.</p>
      <h2>Team policy pack</h2>
      <p>The Team policy pack costs $29 once. One purchase covers one team and its repositories.</p>
      <p>Sociobot is the merchant of record. Refunds are handled there and revoke the related license.</p>
      <h2>Acceptable use</h2>
      <p>Do not use the product to break laws or access repositories without permission.</p>
      <h2>Warranty</h2>
      <p>The product is provided as-is, without warranties. Reviewers remain responsible for release decisions.</p>
      <h2>Questions</h2>
      <p>Email <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p>
    </article>
  `;
}

function notFoundPage(): string {
  return `
    <section class="not-found section-shell">
      <div class="missing-specimen" aria-hidden="true"><span>?</span></div>
      <div>
        <p class="eyebrow">Specimen not catalogued · 404</p>
        <h1 id="page-title" tabindex="-1">Find your way back to the radar</h1>
        <p>This address does not match a field-guide page.</p>
        <a class="button primary" href="/" data-link>Return home</a>
      </div>
    </section>
  `;
}

function currentRoute(): Route {
  if (new URLSearchParams(location.search).get("demo") === "1") return "/demo";
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return (["/", "/demo", "/privacy", "/terms"] as string[]).includes(path) ? path as Route : "/404";
}

function render(focus = false): void {
  window.clearTimeout(demoTimer);
  const route = currentRoute();
  const page = route === "/" ? homePage()
    : route === "/demo" ? demoPage()
      : route === "/privacy" ? privacyPage()
        : route === "/terms" ? termsPage()
          : notFoundPage();
  app.innerHTML = layout(page, route, route === "/demo");
  setMeta(route);
  bindNavigation();
  bindSharedActions(route);
  if (route === "/demo") playDemo(false);
  if (route === "/") {
    bindLicenseForm();
    syncLicenseUI();
  }
  if (focus) {
    const heading = document.querySelector<HTMLElement>("h1");
    heading?.focus();
    const announcer = document.querySelector<HTMLElement>(".route-announcer");
    if (announcer && heading) announcer.textContent = heading.textContent;
  }
  if (location.hash) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
}

function setMeta(route: Route): void {
  const meta = routeMeta[route];
  document.title = meta.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", meta.description);
  const canonicalRoute = route === "/404" ? "/" : route;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", `https://legacy-change-radar.sociobot.in${canonicalRoute}`);
}

function bindNavigation(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.hash) return;
      event.preventDefault();
      history.pushState({}, "", `${url.pathname}${url.search}`);
      window.scrollTo({ top: 0, behavior: "instant" });
      render(true);
    });
  });
}

function bindSharedActions(route: Route): void {
  document.querySelector<HTMLButtonElement>("[data-copy-command]")?.addEventListener("click", async () => {
    const command = "git clone https://github.com/B-Divyesh/sf-legacy-change-radar.git\ncd sf-legacy-change-radar\ncargo install --path .\nlegacy-change-radar scan --base origin/main";
    const status = document.querySelector<HTMLElement>(".copy-status");
    try {
      await navigator.clipboard.writeText(command);
      if (status) status.textContent = "Install command copied.";
    } catch {
      if (status) status.textContent = "The browser blocked copying. Select the command above.";
    }
  });
  document.querySelector<HTMLButtonElement>("[data-reset-demo]")?.addEventListener("click", () => playDemo(true));
  document.querySelector<HTMLButtonElement>("[data-replay-demo]")?.addEventListener("click", () => playDemo(true));
  document.querySelector<HTMLButtonElement>("[data-download-card]")?.addEventListener("click", downloadSampleCard);
  if (route === "/") {
    document.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
      button.addEventListener("click", () => downloadTemplate(button.dataset.template ?? "monorepo"));
    });
  }
}

function playDemo(reset: boolean): void {
  const output = document.querySelector<HTMLElement>("[data-demo-output]");
  const status = document.querySelector<HTMLElement>("[data-playback-status]");
  if (!output) return;
  window.clearTimeout(demoTimer);
  output.replaceChildren();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderLine = (line: typeof demoLines[number]) => {
    const span = document.createElement("span");
    span.className = `record-line ${line.kind}`;
    span.textContent = line.text || " ";
    output.append(span, document.createTextNode("\n"));
  };
  if (!reset || reduceMotion) {
    demoLines.forEach(renderLine);
    if (status) status.textContent = "recorded";
    return;
  }
  if (status) status.textContent = "playing";
  let index = 0;
  const tick = () => {
    renderLine(demoLines[index]);
    index += 1;
    if (index < demoLines.length) demoTimer = window.setTimeout(tick, 90);
    else if (status) status.textContent = "complete";
  };
  tick();
}

function sampleMarkdown(): string {
  return `# Legacy Change Radar

**3 files** · **+6** additions · **−3** deletions

## Review signals

- **migration · high attention** — \`migrations/20260828_add_berth_depth.sql\`
- **public API · medium attention** — \`src/routes/berths.ts\`
- **configuration · medium attention** — \`config/harbor.toml\`

## Dependency edges

- **inbound:** \`src/jobs/tide-reminder.ts\` → \`src/routes/berths.ts\`
- **outbound:** \`src/routes/berths.ts\` → \`src/stores/berths.ts\`

## Required named checks

- [ ] **migration-review**
- [ ] **public-api-contract**
- [ ] **dependent-tests**

> This card shows review context. It does not prove that the change is correct.
`;
}

function downloadSampleCard(): void {
  downloadFile("legacy-change-radar-sample.md", sampleMarkdown(), "text/markdown");
}

const templates: Record<string, string> = {
  monorepo: `# Team policy pack: monorepo\n[[checks]]\nname = "affected-package-tests"\npaths = ["packages/**/src/**"]\nreason = "A package implementation changed."\n`,
  database: `# Team policy pack: database application\n[[checks]]\nname = "migration-and-rollback-review"\npaths = ["migrations/**", "schema/**"]\nreason = "Stored data or schema behavior changed."\n`,
  api: `# Team policy pack: public API service\n[[checks]]\nname = "public-contract-tests"\npaths = ["api/**", "openapi/**", "src/routes/**"]\nreason = "A public contract or route changed."\n`,
};

function downloadTemplate(name: string): void {
  if (!licenseActive || !templates[name]) return;
  downloadFile(`legacy-change-radar-${name}.toml`, templates[name], "application/toml");
}

function downloadFile(name: string, contents: string, type: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([contents], { type }));
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function captureLicense(): void {
  const url = new URL(location.href);
  const token = url.searchParams.get("license");
  if (!token) return;
  localStorage.setItem(LICENSE_KEY, token);
  url.searchParams.delete("license");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function readVerdict(): Verdict | null {
  try {
    return JSON.parse(localStorage.getItem(VERDICT_KEY) ?? "null") as Verdict | null;
  } catch {
    localStorage.removeItem(VERDICT_KEY);
    return null;
  }
}

async function restoreLicense(): Promise<void> {
  const token = localStorage.getItem(LICENSE_KEY);
  if (!token) return;
  const verdict = readVerdict();
  if (verdict?.token === token && verdict.valid) licenseActive = true;
  if (verdict?.token === token && Date.now() - verdict.checkedAt < DAY) return;
  await verifyLicense(token, true);
}

function bindLicenseForm(): void {
  document.querySelector<HTMLFormElement>("[data-license-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem("license") as HTMLInputElement;
    const token = input.value.trim();
    if (!token) return;
    localStorage.setItem(LICENSE_KEY, token);
    await verifyLicense(token, false);
    input.value = "";
  });
}

async function verifyLicense(token: string, background: boolean): Promise<void> {
  const status = document.querySelector<HTMLElement>("#license-status");
  if (!background && status) status.textContent = "Checking this license…";
  try {
    const response = await fetch(`${VERIFY_URL}?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error(`verification returned ${response.status}`);
    const body = await response.json() as { valid: boolean; reason: string };
    const verdict: Verdict = { valid: body.valid, reason: body.reason, checkedAt: Date.now(), token };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    licenseActive = body.valid;
    if (status) status.textContent = body.valid
      ? "License active. Team policy templates are ready."
      : "License no longer active. Check the token or buy a new license.";
  } catch {
    if (status) status.textContent = licenseActive
      ? "Verification is offline. Your last valid verdict still applies."
      : "The license could not be checked. Connect to the internet and try again.";
  }
  syncLicenseUI();
}

function syncLicenseUI(): void {
  const content = document.querySelector<HTMLElement>("[data-team-content]");
  if (content) content.hidden = !licenseActive;
}

window.addEventListener("popstate", () => render(true));
captureLicense();
render();
void restoreLicense().then(syncLicenseUI);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}
