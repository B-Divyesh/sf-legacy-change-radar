import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const dist = new URL("../dist/site/", import.meta.url);

test("production site has required metadata and route files", () => {
  const html = readFileSync(new URL("index.html", dist), "utf8");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Legacy Change Radar — Map change risk before review<\/title>/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.doesNotMatch(html, /https:\/\/.*(?:\.js|\.css|fonts)/);

  const sitemap = readFileSync(new URL("sitemap.xml", dist), "utf8");
  for (const route of ["/demo", "/privacy", "/terms"]) assert.ok(sitemap.includes(route));
  const config = readFileSync(new URL("staticwebapp.config.json", dist), "utf8");
  assert.match(config, /Content-Security-Policy/);
  assert.doesNotMatch(config, /unsafe-inline|unsafe-eval/);
});

test("production assets stay inside first-load budgets", () => {
  const assets = join(dist.pathname, "assets");
  const files = readdirSync(assets);
  const js = files.filter((file) => file.endsWith(".js"));
  const css = files.filter((file) => file.endsWith(".css"));
  const gzipTotal = (names) => names.reduce((sum, name) => sum + gzipSync(readFileSync(join(assets, name))).length, 0);
  assert.ok(gzipTotal(js) <= 150 * 1024, `initial JS is ${gzipTotal(js)} bytes gzip`);
  assert.ok(gzipTotal(css) <= 50 * 1024, `CSS is ${gzipTotal(css)} bytes gzip`);
  assert.ok(statSync(new URL("art/radar-specimen-mobile.webp", dist)).size <= 300 * 1024);
  assert.ok(statSync(new URL("art/radar-specimen.webp", dist)).size <= 300 * 1024);
});
