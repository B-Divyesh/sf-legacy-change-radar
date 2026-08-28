# Legacy Change Radar

Map a code change's owners, dependencies, and review checks.

Legacy Change Radar is for maintainers reviewing changes in established
applications. It reads a Git diff and writes a compact Markdown risk card before
line-by-line review.

It reports:

- changed files and line counts;
- matching owners from `CODEOWNERS`;
- local import edges for JavaScript, TypeScript, Python, and Rust;
- configuration, migration, public API, and generated-file markers;
- named checks from built-in rules and `.legacy-change-radar.toml`.

Every inferred edge includes its source text and reason. The report is review
context, not proof that a change is correct.

## Try the bundled demo

```sh
cargo run -- demo
```

The command creates a temporary sample repository, runs the same analyzer used
for real diffs, writes `legacy-change-radar.md`, and prints its location. Sample
files also live in [`examples/harbor-app`](examples/harbor-app).

See the recorded browser demo at
<https://legacy-change-radar.sociobot.in/demo>.

## Install

Rust 1.85 or newer is required.

```sh
cargo install --path .
legacy-change-radar --help
```

The repository produces one CLI binary. It sends no telemetry and makes no
network requests.

## Scan a pull request

```sh
git fetch origin main
legacy-change-radar scan \
  --base origin/main \
  --head HEAD \
  --output legacy-change-radar.md
```

When `--base` is omitted, the CLI reads staged and unstaged changes. Use
`--diff-file pull-request.diff` in CI when the patch already exists.

For scripting, choose JSON:

```sh
legacy-change-radar scan --base origin/main --format json --output radar.json
```

Exit code `0` means analysis completed. Exit code `2` means the input or Git
command failed. Findings never change the exit code because they need human
review.

## Add repository policy

Create `.legacy-change-radar.toml`:

```toml
[[checks]]
name = "billing-contract-tests"
paths = ["src/billing/**", "api/billing/**"]
reason = "Billing behavior changed."

[[owners]]
pattern = "migrations/**"
names = ["@data-platform"]
```

Rules are additive to `CODEOWNERS` and the built-in safety checks. Glob syntax
supports `*`, `**`, and `?`.

## Team policy pack

The free CLI includes analysis, Markdown, JSON, and custom repository rules.
The optional Team policy pack costs **$29 once**. It adds maintained policy
templates for monorepos, database applications, and public API services. Buy or
restore it on the product site. Sociobot is the merchant of record.

## Develop and verify

```sh
npm install
npm test
npm run build
```

`npm test` runs Rust tests, site unit checks, production build checks, and
Playwright claim tests. `npm run build` places the static site in `dist/site`.

Package checks:

```sh
cargo package --allow-dirty
```

## Deploy

The landing site is static. Deploy `dist/site` after `npm run build`. The CLI is
ready for registry publishing, but factory workers do not publish packages.

## Privacy

The CLI reads only the repository and Git data you name. The static site stores
only an optional license token and daily verification result in browser storage.
See [privacy](https://legacy-change-radar.sociobot.in/privacy) and
[terms](https://legacy-change-radar.sociobot.in/terms).

## License

MIT. See [`LICENSE`](LICENSE).
