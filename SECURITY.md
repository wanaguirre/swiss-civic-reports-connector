# Security

Report vulnerabilities privately using
[GitHub private vulnerability reporting](https://github.com/wanaguirre/swiss-civic-reports-connector/security/advisories/new).
Do not include credentials or personal reports in public issues.

Only the latest release receives fixes. This project has not had an independent
security audit. Keep municipal submission disabled during setup and tests;
never send fictional reports.

Keep bot tokens, AI credentials and report data outside Git. Restrict `.env` and
the private data directory to their owner. File permissions do not encrypt data.
Local stdio can import files and should only be connected to a trusted client.
HTTP mode requires one strong bearer token and disables local file imports.
Use TLS and appropriate network access controls if serving it beyond localhost.

An AI client's `human_confirmed` assertion does not prove human consent. The
client must obtain approval of the exact preview. Telegram additionally checks
the latest preview's Send button, allowed user and private chat. Uncertain
submission attempts are retained and must not be retried automatically.
