# Contributing

Run Node.js 22+ with `npm ci` and `npm run check`. Tests mock municipal writes.
The optional `npm run doctor` and `npm run verify:installation` checks read live
municipal services. Never submit fictional reports.

Keep reporting behavior in the shared core. MCP, Telegram and consuming apps
should use the same validation, immutable previews and duplicate protection.
Interface-specific behavior belongs in its adapter. Preserve the public package
exports and test affected consumers before releasing a breaking change.

Read the [architecture](docs/ARCHITECTURE.md) before changing persistence,
approval or submission. Use `npm run format:write` for the agreed code style.
Comments should explain constraints, failure behavior and non-obvious decisions;
avoid narrating code that clear names already explain. Document changes to public
APIs and environment settings alongside their implementation. Measure a suspected
bottleneck before making the design more complex.

For a change, describe the problem, update relevant tests and documentation, and
open a pull request. Record what was actually verified; mocked tests do not
prove a real bot exchange or municipal acceptance. Keep credentials, personal
photos, contact details and private reports out of code, fixtures and issues.
