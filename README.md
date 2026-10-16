# Swiss Civic Reports

Prepare public-space maintenance reports through your AI assistant or your own
Telegram bot. Confirm the location, review the photos and text, then approve the
exact report before sending.

| Interface | Use it when |
| --- | --- |
| **MCP** | You want your existing AI assistant to use the reporting tools. No Telegram account is needed. |
| **Telegram** | You want to report from a private bot on your phone. Run the bot on your computer or server; no separate MCP client or server setup is needed. |
| **Shared core** | You are building an application that needs the same location, photo, preview and reporting logic. |

Telegram uses the MCP tools internally in the same process. Automatic Telegram
drafting optionally uses your Codex login; manual drafting needs no AI account.
The bot's host must stay online.

## Install

Requires **Node.js 22+** and npm.

```sh
git clone https://github.com/wanaguirre/swiss-civic-reports-connector.git
cd swiss-civic-reports-connector
npm ci
npm test
```

Follow the [setup guide](docs/SETUP.md#set-up-mcp) for MCP or
[Telegram setup](docs/SETUP.md#set-up-telegram) for your bot.
`npm run doctor` and `npm run verify:installation` perform live read-only checks.

## Scope

This repository owns the shared reporting core, MCP and Telegram. Applications
consume its [versioned package API](docs/DEVELOPMENT.md); do not copy the core
into another project. Browser interfaces, account services and deployments are
separate consumers and are not included here.

The installed CLI and Telegram use Zürich. The shared package also exports an
experimental [Anthrazit adapter](docs/ANTHRAZIT.md) for Winterthur, St. Gallen, Schaffhausen, Dietikon, Köniz, Frauenfeld, Allschwil,
Wil (SG), Bottmingen, Moosseedorf and the deferred Schlieren profile.
Their category/location reads are verified; municipal acceptance is not.
Schlieren direct sending remains unavailable; no municipal login is implemented. This is an independent,
unofficial project. Direct submission is experimental and **off by default**;
the official municipal form is the fallback. A real Telegram exchange and an
accepted municipal submission still need verification; passing tests do not
establish those live journeys.

The shared package also includes disabled [Bern/Fribourg preparation adapters](docs/MUNICIPAL-FORMS.md).
They collect the observed fields but cannot send; actual uploads and municipal receipts remain unverified.

## Develop

`src/` contains the core and transports; `test/` covers behavior with mocked
municipal writes. `scripts/` and `docs/` provide installation and verification.
GitHub Actions runs tests on Node 22 and 24. Releases include an installable package;
this package is not published to npm.

Run `npm run check` before contributing. It checks formatting, compiles strict
TypeScript, runs tests and validates the release package.

[Architecture](docs/ARCHITECTURE.md) · [Development](docs/DEVELOPMENT.md) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

[MIT](LICENSE). You may use, modify and redistribute the code, including
commercially, provided you retain its copyright and license notices. The software
is provided without warranty. This license does not imply municipal endorsement.

## Signalements-Riviera

The shared [Riviera adapter](docs/RIVIERA.md) prepares French reports for ten
municipalities and can build the observed multipart request locally. It preserves
location-specific categories, scope warnings, optional email, a one-photo limit
and the 1,000-character description limit. Live sending and receipts remain
unverified and cannot be enabled. All municipal writes in tests are mocked.

## Zuchwil

The [Zuchwil adapter](docs/ZUCHWIL.md) prepares German reports with required title,
issue address and email, optional name/phone and one photo, and frozen privacy
terms. It validates the anonymous Weblication form and constructs session-bound
upload/form plans locally. Sending and receipt handling remain unverified and
cannot be enabled. No municipal login or external-form completion is offered.

## Riehen and Ebikon preparation (core 0.4.0-rc.10)

[Riehen](docs/RIEHEN.md) distinguishes infrastructure damage (no attachments)
from public-property graffiti (one optional photo under 2 MB). Ebikon joins the
[municipal-form adapter](docs/MUNICIPAL-FORMS.md) with eight public-space damage
classes. Both default to preparation-only. Structured category scope, photo byte/count
limits and location/text limits are shared by validation and consuming interfaces.

## Meggen and shared OneGov transport (core 0.4.0-rc.11)

Meggen adds one narrowly defined infrastructure-safety class, required first/last
name and email, and one optional photo. The [municipal-form adapter](docs/MUNICIPAL-FORMS.md)
now includes a source-reviewed, experimental upload → review → completion → ticket
transport shared with Ebikon. It requires explicit library opt-in and remains off
in Civic. No real report or upload was sent; municipal acceptance needs a genuine
pilot. Mocked tests cover exact review matching, receipt validation, uncertainty,
rate-limit pauses and durable prevention of repeated submissions.
