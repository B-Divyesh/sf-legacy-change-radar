# Demo sandbox

## Entry points

- Browser: `https://legacy-change-radar.sociobot.in/demo` or `?demo=1`
- CLI: `cargo run -- demo`

The landing-page action opens the browser demo in one click. The CLI command
creates a unique temporary directory, copies the bundled sample there, runs the
real analyzer, and prints both report and temporary path.

## Sample data

`examples/harbor-app` contains a small harbor operations application, CODEOWNERS,
repository policy, and `sample.diff`. The patch changes a public berth route,
adds a database migration, and updates harbor configuration. One unchanged job
imports the changed route, so the demo contains both inbound and outbound edges.

## Isolation and reset

The browser demo reads static bundled data. It does not read or write local
storage, IndexedDB, or OPFS. Its effective namespace is `demo:`, with zero keys.
“Reset demo” clears the terminal element in memory and replays the recording.
“Start for real” leaves the demo and opens the install section.

The CLI demo uses a new system temporary directory per invocation. It never
reads the current repository's Git history or policy. Users may delete the
printed temporary directory after inspection.

## Verification

Claim tests start in a fresh browser context or use the bundled sample path.
They assert report contents, request origins, storage keys, download output, and
the licensed template state without using a live payment or network service.
