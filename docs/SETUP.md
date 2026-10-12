# Swiss Civic Reports: MCP and Telegram setup

Run Swiss Civic Reports on your computer or a server you control. Use it through
an AI assistant with MCP support, your own private Telegram bot, or both. You
review the prepared report before anything is sent. No application account is needed
to run either option.

The aim is to support as many Swiss municipalities as possible. Each connection
is verified before it is added; today the connector supports the city of Zürich.

## Choose your route

- **MCP:** connect your AI assistant to the reporting tools. The assistant uses
  its own model to help you prepare the report. The connector runs on your host.
- **Telegram:** create your own bot with BotFather and run the bridge on your
  host. Use it from your phone while the host stays online. Automatic drafting
  currently uses your Codex account; manual drafting is also available.

Both routes use the standalone connector source. They do not connect to the
maintainer's server or require the browser application's source code.

## Get the source

```sh
git clone https://github.com/wanaguirre/swiss-civic-reports-connector.git
cd swiss-civic-reports-connector
```

Use this official repository or its tagged releases. No public hosted MCP
endpoint or npm registry package is provided.

## Requirements

- Node.js 22 or later, npm, and the source checkout on a Mac or other host.
- An MCP-capable AI client for the MCP route. A local coding assistant can install
  it; a chat assistant without filesystem/terminal access can only guide you.
- For Telegram: Telegram, your own BotFather token and numeric user ID, and a
  host that stays online. The bot is private to one allowed user.
- AI drafting in MCP uses the client's own model. Telegram supports manual
  drafting or the Codex CLI with your own saved login and account usage.

## Build and verify

From the source directory:

```sh
npm ci
npm test
npm run doctor
node scripts/verify-installation.mjs
```

The tests mock municipal submissions. The last two commands read live Zürich
services; the installation check imports a synthetic image and creates a local
preview in disposable storage. It forces sending off and never submits a report.

## Set up MCP

For Codex, install/login to the Codex CLI first, then run:

```sh
node scripts/install-codex.mjs --dry-run
node scripts/install-codex.mjs
```

The installer registers the built server and companion skill. It refuses to
overwrite existing entries. Start a new task or restart the client. Keep the
source directory in place and rebuild after source changes.

For a client supporting local stdio, configure the following server with actual
absolute paths. Merge it into the existing configuration; preserve other servers.

```json
{
  "mcpServers": {
    "zueri-wie-neu": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/source/dist/cli.js"],
      "env": { "ZURI_ENABLE_SUBMISSION": "false" }
    }
  }
}
```

Test `server_status` and `list_categories` through your client. It must be able
to pass the image bytes or a local path to `inspect_photo`; seeing a photo in chat
does not prove tool access to it. Client compatibility must be verified in your
actual client. No hosted review panel is bundled with this installation.

## Set up Telegram

1. Open the verified [@BotFather](https://t.me/BotFather) in Telegram. Send
   `/newbot` and choose a name and username. This step creates the bot account.
2. Copy `.env.example` to `.env` only if `.env` does not already exist, and run
   `chmod 600 .env`. Enter the bot token locally as `ZURI_TELEGRAM_BOT_TOKEN`.
   Never paste it into an AI conversation, issue or public document.
3. Run `node --env-file=.env scripts/telegram-identity.mjs`. Send `/start` to your
   bot, rerun the command if needed, and save your own displayed numeric ID in
   `ZURI_TELEGRAM_USER_ID`. Other users and group chats are ignored.
4. Keep `ZURI_ENABLE_SUBMISSION=false`. Start with `ZURI_TELEGRAM_AI=manual`.
   For optional AI drafting, run `codex login`, then set `ZURI_TELEGRAM_AI=codex`.
   If necessary, set `ZURI_CODEX_COMMAND` to the CLI's absolute path.
5. Run `npm run telegram`. Keep the process running. Use one instance per bot;
   an existing webhook is rejected. No background service is installed.

For a first test, send a harmless image and confirm that the bot responds. In
manual mode use `/categories`, `/category`, `/describe`, `/email`, a location pin
or `/address`, and `/preview`. Confirm the exact location with the bot's button.
In Codex mode the bot suggests text/category, asks for missing details and creates
a preview. Review it but keep city sending disabled throughout the test.

Use `/new` for a new draft, `/cancel` to clear the current one and `/status` for
local receipts. A restart loses the in-memory conversation. Photos may lose GPS
when sent as ordinary Telegram images; send the original as a file if needed.

## Sending a genuine report

The normal fallback is the official city form. Its link contains the category,
description and location; add photos and contact details there yourself.

Direct sending uses an experimental legacy endpoint, not Zürich's documented
read-only Open311 API. Deliberately enabling `ZURI_ENABLE_SUBMISSION=true` is
separate from setup. Every report still requires approval of its exact preview;
Telegram requires its latest Send button. Never send fictional test reports.
An `unknown` or `sending` receipt means the outcome must be resolved before any
retry or switch to the official form. City email confirmation may also be needed.

## Data and limits

- Credentials belong in local configuration. The core MCP makes no model calls.
  Telegram processes bot messages; bot chats are not Secret Chats. Optional Codex
  drafting sends normalized images and issue text to the user's Codex service.
- The connector reads categories/rules/reports from `www.zueriwieneu.ch` and
  searches addresses with `api3.geo.admin.ch`.
  Report text, contacts and photos are sent to the city only on approved submission.
- Up to three photos, 15 MiB each. JPEG/PNG/WebP are supported; HEIC depends on
  the host's image decoder. EXIF is removed; visible faces/plates are not redacted.
- Private storage defaults to `~/.local/share/zueri-wie-neu-mcp` (or below
  `XDG_DATA_HOME`); override with `ZURI_DATA_DIR`. Drafts/photos expire after an
  hour and are cleaned up on startup/activity. A stopped process cannot clean up.
  Receipts persist for duplicate protection and may retain the report description,
  public status/reply and translations. Contact fields and photos are not kept in
  receipts. File permissions are not encryption.
- Only Zürich is supported. No public multi-user Telegram bot, voice transcription
  or automatic background hosting is included. Some special category fields
  require the official form.

## Verification boundaries

Automated tests cover the core, MCP transports and Telegram controller with
mocked municipal writes. The read-only installation check exercises real MCP
photo import and preview preparation. A real bot exchange and municipal acceptance
still need separate verification. Keep submission disabled while testing.

References: [Telegram setup](https://core.telegram.org/bots/tutorial),
[Zürich Open311](https://www.zueriwieneu.ch/open311/).
