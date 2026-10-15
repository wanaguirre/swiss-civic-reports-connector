# Architecture

The public package owns reporting behavior. MCP and Telegram adapt it to a
conversation; consuming applications add their own interface and authentication.
Importing the package has no server-starting side effects.

## Module boundaries

| Modules | Responsibility |
| --- | --- |
| `model`, `reporting-draft`, `reporting-guidance` | Input schemas, shared records, model-output validation and sourced drafting guidance. |
| `city`, `zuchwil`, `riviera`, `municipal-forms`, `anthrazit`, `anthrazit-traffic`, `municipalities`, `places` | Municipal API calls, geographic lookup and supported-adapter identification. |
| `photos` | Bounded image import, normalization and thumbnails. |
| `service` | Live rule validation, preparation, approval checks and submission orchestration. |
| `store`, `storage-budget`, `durable-files` | Private persistence, storage limits, atomic publication and duplicate prevention. |
| `tracking`, `language` | Read-only follow-up of public reports and stored translations. |
| `server`, `http` | MCP tools, stdio-compatible server construction and authenticated single-user HTTP. |
| `telegram-api`, `telegram-bot`, `telegram`, `telegram-draft` | Telegram requests, the conversation controller, sequential polling and optional Codex drafting. |
| `run-cli`, `cli`, `index` | Explicit process startup and package exports. |

`ReportService` accepts a `ReportingAdapter`: Zürich `CityClient` or the experimental
[Anthrazit adapter](ANTHRAZIT.md), or the disabled
[Bern/Fribourg preparation adapters](MUNICIPAL-FORMS.md) and
[Signalements-Riviera adapter](RIVIERA.md), plus the disabled
[Zuchwil adapter](ZUCHWIL.md). Consumers select an adapter from the authoritative
BFS boundary result. Previews and receipts bind BFS plus service identity; records
without a destination belong only to the original Zürich service. Terms are frozen
and integrity-checked separately from the payload identity used to prevent duplicate
sends. Adding an adapter does not enable it in a consuming application.

## Reporting flow and invariants

1. Import at most three photos. The importer caps bytes and pixels, rejects
   unsupported inputs, normalizes images and removes EXIF. GPS is a suggestion.
2. Confirm the issue location, load live categories and requirements, and validate
   the draft. Searching for an address does not confirm it.
3. Save an immutable preview of the destination, input, terms and exact photo hashes. Previews expire
   after one hour; changing a Telegram draft invalidates its approval button.
4. Require submission opt-in, approval of that preview and any municipal terms acceptance. Recheck current city
   rules with `requirements(point, { fresh: true })` (bypassing preparation caches), then durably create an exclusive claim for the payload fingerprint.
5. Dispatch once. Persist acceptance, rejection or uncertainty. A crash or timeout
   never authorizes replay: the claim survives restart and equivalent new previews.

The HTTP adapter checks Host, Origin and a bearer token and disallows filesystem
photo paths. Telegram accepts only the configured user's private chat and the
latest preview button. MCP clients remain responsible for obtaining real human
approval; a boolean tool argument alone cannot establish consent.

## Persistence and resource use

Media is stored once per content hash within a storage identity and referenced by
photos and previews. Cleanup determines every live reference before deleting
expired records or unreferenced media. Receipts are retained to prevent duplicates.
Writes flush the file and synchronize the containing directory. An exclusive
filesystem lock serializes storage admission and cleanup across processes.
An interrupted lock is not automatically stolen; see recovery below.

Image dimensions, upload bytes, transient storage and HTTP requests are bounded.
Municipality and address lookups run concurrently. Tracking limits public lookups
and skips recently checked reports. Preview thumbnails are encoded once and reused
for chat and optional UI metadata.

This is a small-installation filesystem design, not a benchmarked high-throughput
service. Receipt reads scan the installation's receipts. Telegram handles updates
sequentially; optional AI drafting delays later updates. Do not parallelize writes
or introduce caches without checking approval, expiry and duplicate guarantees.

## Failure recovery

- `sending` or `unknown`: inspect the receipt, confirmation email and official city
  site before any further action. Never delete a receipt to bypass duplicate protection.
- Persistent storage-lock error: stop **all** processes using that storage root and
  preserve a private backup. Once no writer remains and the interrupted operation
  has been inspected, remove only `.transient-storage.lock` from that root. Restart
  one process; cleanup validates live records before reclaiming transient files.
- Corrupt record or missing media: preserve evidence and investigate. Do not clear
  the directory as a repair step when a submission may have reached the city.

## Verification boundary

Tests cover validation, photo handling, durable claims, concurrency, expiry,
tracking, transports and the Telegram controller with mocked municipal writes.
The installation check exercises a real MCP connection and live read-only services.
A dedicated real Telegram journey, municipal acceptance and load benchmarks remain
separate verification tasks. See [setup](SETUP.md) and [security](../SECURITY.md).
