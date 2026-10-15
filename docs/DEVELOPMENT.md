# Shared core and releases

This repository is the source of truth for reporting behavior. The MCP server,
Telegram bridge and consuming applications use the same core. Fix shared logic
here, then update consumers to a tested release. A new release does not silently
change deployed applications.

Read the [architecture](ARCHITECTURE.md) for module boundaries, reporting
invariants, resource limits and recovery behavior.

## Local checks

```sh
npm ci
npm run check
```

`check` runs pinned Prettier formatting checks, a clean TypeScript build, behavior
tests and package verification. TypeScript enables strict mode, unused-code checks
and no output on compilation errors. Use `npm run format:write` to format edits.
During development, build once and run a focused `node --test test/NAME.test.mjs`;
run the complete check before submitting the final change.

The package verifier checks compiled modules against current source files,
declared exports, required documentation and relative links inside the archive.
It inspects the already-tested build without rerunning lifecycle scripts. A clean
build prevents removed source files from surviving in `dist` and later releases.

CI tests Node 22 and 24 on Linux; local verification also runs on macOS. Windows
filesystem durability and installation have not been verified.

## Package API

```js
import { CityClient, Store, ReportService, SwissPlaces, resolvePlace }
  from '@wanaguirre/swiss-civic-reports';
```

The package exports TypeScript declarations. Explicit subpaths expose the model,
photos, language, drafting, storage and transport modules listed in `package.json`.
Do not import unexported `dist/` paths. Importing the package does not start a
server. `runCli` is available through the `/run-cli` subpath for command wrappers.
The MCP tool server can accept a consumer-provided review resource; no browser
application or hosted identity service is bundled.

Applications install the release package by its HTTPS asset URL and commit the
resulting lockfile. Its integrity hash verifies the installed bytes. For local
development, run `npm pack` here, then install that archive in the consuming app.
Restore the versioned release dependency before committing the consumer.

## Release

1. Update the package version and lockfile together. Align protocol version
   strings in `src/server.ts`, `src/city.ts`, `src/places.ts` and `src/telegram.ts`.
2. Run `npm ci` and `npm run check`. Inspect the source and runtime
   inventories; exclude credentials, reports and consumer application code.
3. Run `npm pack`, install that archive in an empty directory and in affected
   consumers, then run their tests. Check the actual packaged CLI, not only the
   development checkout.
4. Commit the source, tag the version and attach the tested package to its GitHub
   release. Record actual checks and unresolved live verification in release notes.
5. Update consumers to that release URL, commit their lockfiles, and verify before
   deployment. Do not enable city writes as part of a code release.

GitHub source, package release, client registration and application deployment
are separate operations. No npm registry publication is configured.
`private: true` in `package.json` prevents accidental npm publication; it does
not make the GitHub source or release downloads private.

## Municipality adapters

The package exports `ReportingAdapter`, `AnthrazitClient` and the `anthrazit` /
`municipalities` subpaths. See [Anthrazit](ANTHRAZIT.md) for tenant capabilities,
extra fields, terms acceptance and verification limits. `ReportService.submit`
accepts an optional fourth `acceptedTermsUrl` argument; it is required when the
frozen preview contains municipal terms. Existing Zürich calls stay unchanged.
