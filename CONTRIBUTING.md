# Contributing

Run Node.js 22+ with `npm ci` and `npm test`. Tests mock municipal writes.
The optional `npm run doctor` and `npm run verify:installation` checks read live
municipal services. Never submit fictional reports.

Keep reporting behavior in the shared core. MCP, Telegram and consuming apps
should use the same validation, immutable previews and duplicate protection.
Interface-specific behavior belongs in its adapter. Preserve the public package
exports and test affected consumers before releasing a breaking change.

For a change, describe the problem, update relevant tests and documentation, and
open a pull request. Record what was actually verified; mocked tests do not
prove a real bot exchange or municipal acceptance. Keep credentials, personal
photos, contact details and private reports out of code, fixtures and issues.
