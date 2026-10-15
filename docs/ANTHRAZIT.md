# Anthrazit Stadtmelder adapter

`AnthrazitClient` shares category, location, session, upload and wizard handling
for Winterthur (BFS 230) and Schlieren (BFS 247). Tenant IDs and hosts are pinned
in code. It implements the same `ReportingAdapter` boundary as Zürich, so a
consumer can use `ReportService` and `createServer` without copying the workflow.
This is an experimental integration of official web forms, not a documented
public write API. The installed CLI and Telegram defaults remain Zürich.

## What was verified on 15 October 2026

| Check | Winterthur | Schlieren |
| --- | --- | --- |
| Live adapter categories and location rules | 11 categories; authoritative BFS boundary plus radius check passed at the site's default centre | 10 categories; same checks passed at its default centre |
| Anonymous browser navigation through upload/details | Observed | Observed |
| Upload contract in the official page's JavaScript | Multipart `img`; tenant-specific `usmid`/`usid`; 15 MB; one file per interaction | Same |
| Details form | Required `objekttitel`; `objekttext`, issue address, private contact text, email and notification checkbox | Same |
| Final form inspection without report details | POST current step 5; blank `stepback` and `proceed`; unnamed “Absenden” button; terms link | Login form, including when the preceding `jsr=1` parameter was preserved |
| Real upload, completed details, final send and acceptance | **Not exercised** | **Not exercised; completed guest flow unresolved** |

Sources: [Winterthur official wizard](https://m.winterthur.ch/index.php?apid=1643504707&embed=true&do=add),
[Winterthur linked terms/privacy notice](https://m.winterthur.ch/index.php?apid=1873279288),
[Schlieren official wizard](https://m.schlieren.ch/index.php?apid=1837234&do=add).

Browser inspection advanced the location/upload steps using each site's default
map centre and no photo. These are anonymous session POSTs, not report sends.
No title, description, contact details or files were supplied. The final step
was inspected by GET without submitting the details form. In particular, the
Schlieren observation does **not** prove that every completed report requires
an account; it leaves that question unresolved. No login or challenge was bypassed.

The email field's label has an asterisk but lacks HTML `required`; the connector
continues to require email. One photo is an explicit initial connector limit,
not a claim about the city's total album capacity. The native widget limits one
file per interaction and reloads afterward. Issue address fields are optional;
the connector sends the approved components or blanks, never the site's default
reverse-geocoded street. Coordinates remain the confirmed issue point.

## Use from a consumer

```ts
import { AnthrazitClient, ReportService, Store } from '@wanaguirre/swiss-civic-reports';
import { createServer } from '@wanaguirre/swiss-civic-reports/server';

const city = new AnthrazitClient('winterthur'); // or 'schlieren'; writes disabled
const service = new ReportService(city, new Store('./private-data'), {
  submissionEnabled: false,
  allowPaths: false,
});
const server = createServer(service);
```

Choose the adapter from the authoritative BFS result for the confirmed point,
not from user text or a category label. `requirements` repeats the boundary check
and the tenant's location preflight. Use the live category **name** in the input;
its current numeric category ID is resolved again inside the fresh send session.

The extra fields exposed by both tenants are:

- `report_title`: required, German, at most 100 characters (connector limit).
- `street`, `postcode`, `place`: optional issue address components, shown verbatim
  in the frozen preview and transmitted without guessing.
- `notify_updates`: optional `yes` or `no`; omitted means no email-update subscription.

There is no verified public lookup/tracking adapter. Duplicate search is explicitly
unavailable, and receipts cannot be linked to Zürich's public feed. An official
form fallback opens a blank form; it does not prefill or transfer the draft.

Winterthur can be opted into a controlled genuine-report validation with
`new AnthrazitClient('winterthur', fetch, { experimentalSubmission: true })`
**and** `ReportService`'s `submissionEnabled: true`. Show the complete preview,
all extra fields, photos and `terms_url`. Obtain explicit report approval and
acceptance of those terms, then pass the exact `accepted_terms_url` to the MCP
`submit_report` tool (or the fourth `ReportService.submit` argument). Existing
consumer interfaces that do not collect this consent cannot send these reports.
Schlieren ignores the experimental opt-in and remains preparation-only until its
completed final flow is established. Neither tenant is automatically enabled in
the private Civic application by adding this package.

## Failure behavior and verification still required

Every municipal POST, including location staging and photo upload, happens after
`ReportService` acquires its durable exclusive claim. Sessions and cookies are
isolated per attempt. Unknown form fields, off-origin destinations, unexpected
steps, login screens, changed terms and mismatched preview text stop progression.
Redirects never replay POST bodies; final-send redirects are not followed.

No success response has been verified. Even a completed experimental Winterthur
send returns `unknown`, never `accepted` or `confirmation_pending`. Check the
municipal service manually; do not resend. All uncertain attempts retain their
claim across process restarts and equivalent new previews. Terms are frozen and
integrity-checked separately from the report's duplicate identity, so a terms
change cannot authorize an equivalent second send. Legacy Zürich hashes and
records preserve their previous identity and route exclusively to Zürich.

Tests reconstruct the observed forms with synthetic content and mock all writes.
They verify sequencing, exact payloads, tenant isolation, terms/approval gates,
photo handling, redirects, contract drift, and durable no-replay behavior. These
tests do not prove municipal acceptance. Before production enablement, use a
genuine specifically approved report to verify uploads, the completed preview,
the final response and receipt, then add only observed success/status parsers.
Civic prepares Winterthur reports behind an off-by-default flag and consumes a
versioned core dependency. Schlieren remains excluded while anonymous completion
is unverified; no municipal login integration is planned.

`report_title` is marked `translate: true` in requirements so clients translate
it with the public description. Contact and issue-address fields must not be
sent for translation.
