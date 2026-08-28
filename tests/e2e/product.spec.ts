import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const binary = resolve(root, "target/debug/legacy-change-radar");
const sampleRepo = resolve(root, "examples/harbor-app");

test("@claim:risk-card maps the sample change and writes both formats", async () => {
  const jsonText = execFileSync(binary, [
    "scan", "--repo", sampleRepo, "--diff-file", resolve(sampleRepo, "sample.diff"), "--format", "json",
  ], { encoding: "utf8" });
  const report = JSON.parse(jsonText);
  expect(report.summary.files_changed).toBe(3);
  expect(report.owners.map((item: { owners: string[] }) => item.owners).flat()).toContain("@api-maintainers");
  expect(report.dependency_edges.some((edge: { direction: string }) => edge.direction === "inbound")).toBeTruthy();
  expect(report.signals.map((signal: { kind: string }) => signal.kind)).toEqual(expect.arrayContaining(["migration", "configuration", "public API"]));
  expect(report.required_checks.map((check: { name: string }) => check.name)).toContain("harbor-contract-tests");

  const markdown = execFileSync(binary, [
    "scan", "--repo", sampleRepo, "--diff-file", resolve(sampleRepo, "sample.diff"), "--format", "markdown",
  ], { encoding: "utf8" });
  expect(markdown).toContain("## Dependency edges");
  expect(markdown).toContain("## Required named checks");
  expect(markdown).toContain("does not prove that the change is correct");

  const adapterRepo = mkdtempSync(resolve(tmpdir(), "radar-adapters-"));
  try {
    mkdirSync(resolve(adapterRepo, "pkg"), { recursive: true });
    mkdirSync(resolve(adapterRepo, "src"), { recursive: true });
    writeFileSync(resolve(adapterRepo, "pkg/changed.py"), "from .helper import read\n");
    writeFileSync(resolve(adapterRepo, "pkg/helper.py"), "def read(): return 1\n");
    writeFileSync(resolve(adapterRepo, "src/changed.rs"), "pub fn changed() {}\n");
    writeFileSync(resolve(adapterRepo, "src/caller.rs"), "use crate::changed;\n");
    const adapterDiff = "diff --git a/pkg/changed.py b/pkg/changed.py\n--- a/pkg/changed.py\n+++ b/pkg/changed.py\n@@ -1 +1 @@\n-from .helper import old\n+from .helper import read\ndiff --git a/src/changed.rs b/src/changed.rs\n--- a/src/changed.rs\n+++ b/src/changed.rs\n@@ -1 +1 @@\n-pub fn old() {}\n+pub fn changed() {}\n";
    writeFileSync(resolve(adapterRepo, "sample.diff"), adapterDiff);
    const adapters = JSON.parse(execFileSync(binary, ["scan", "--repo", adapterRepo, "--diff-file", resolve(adapterRepo, "sample.diff"), "--format", "json"], { encoding: "utf8" }));
    expect(adapters.dependency_edges.some((edge: { reason: string }) => edge.reason.includes("Python adapter"))).toBeTruthy();
    expect(adapters.dependency_edges.some((edge: { reason: string }) => edge.reason.includes("Rust adapter"))).toBeTruthy();
  } finally {
    rmSync(adapterRepo, { recursive: true, force: true });
  }
});

test("@claim:local-private demo makes no cross-origin request and saves no demo data", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4173") external.push(request.url());
  });
  await page.goto("/demo");
  await expect(page.getByText("Demo — sample data, nothing is saved")).toBeVisible();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("migration-review", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("demo:")))).toEqual([]);
  expect(external).toEqual([]);

  const cargoLock = readFileSync(resolve(root, "Cargo.lock"), "utf8");
  const rustSource = readFileSync(resolve(root, "src/lib.rs"), "utf8") + readFileSync(resolve(root, "src/main.rs"), "utf8");
  expect(cargoLock).not.toMatch(/name = "(?:reqwest|hyper|ureq|curl|tokio)"/);
  expect(rustSource).not.toMatch(/TcpStream|UdpSocket|openai|analytics|telemetry/);
});

test("@claim:one-click-demo opens a used sample and downloads its card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try it with sample data" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("3 files · +6 additions · −3 deletions")).toBeVisible();
  await expect(page.getByText("tide-reminder.ts → src/routes/berths.ts", { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample card" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("legacy-change-radar-sample.md");
  await page.goto("/?demo=1");
  await expect(page).toHaveTitle("Demo — Legacy Change Radar");
  await expect(page.getByText("Demo — sample data, nothing is saved")).toBeVisible();
});

test("@claim:team-pack verifies a license and provides three templates", async ({ page }) => {
  await page.route("https://api.sociobot.in/api/v1/products/legacy-change-radar/verify?license=test-license", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true, reason: "ok", expires_at: null }) });
  });
  await page.goto("/");
  await expect(page.getByLabel("29 US dollars, one time")).toBeVisible();
  await expect(page.getByRole("link", { name: /Buy Team pack/ })).toHaveAttribute("href", "https://api.sociobot.in/api/v1/products/legacy-change-radar/checkout");
  await page.getByLabel("Have a license? Paste it here.").fill("test-license");
  await page.getByRole("button", { name: "Verify license" }).click();
  await expect(page.getByText("License active. Team policy templates are ready.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Team policy templates" })).toBeVisible();
  await expect(page.locator("[data-template]")).toHaveCount(3);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download database policy" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("legacy-change-radar-database.toml");
  expect(await page.evaluate(() => localStorage.getItem("sb_license:legacy-change-radar"))).toBe("test-license");
});

test("all routes have one heading, clear titles, and no serious accessibility errors", async ({ page }) => {
  for (const route of ["/", "/demo", "/privacy", "/terms", "/missing-specimen"]) {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/Legacy Change Radar/);
    await expect(page.locator("img:not([alt])")).toHaveCount(0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    expect(errors).toEqual([]);
  }
});

test("keyboard navigation moves focus to the destination heading", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.getByRole("link", { name: "Demo" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("the 390px layout does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/demo", "/privacy", "/terms"]) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("license return URL stores the token and removes it from the address", async ({ page }) => {
  await page.route("https://api.sociobot.in/api/v1/products/legacy-change-radar/verify?license=return-token", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true, reason: "ok" }) }),
  );
  await page.goto("/?license=return-token");
  await expect(page).toHaveURL("/");
  expect(await page.evaluate(() => localStorage.getItem("sb_license:legacy-change-radar"))).toBe("return-token");
});

test("a current cached license verdict skips repeat verification", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sb_license:legacy-change-radar", "cached-token");
    localStorage.setItem("sb_license_verdict:legacy-change-radar", JSON.stringify({
      valid: true,
      reason: "ok",
      checkedAt: Date.now(),
      token: "cached-token",
    }));
  });
  const verifyRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/verify")) verifyRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Team policy templates" })).toBeVisible();
  expect(verifyRequests).toEqual([]);
});
