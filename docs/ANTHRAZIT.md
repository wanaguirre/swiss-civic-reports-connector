# Anthrazit Stadtmelder adapter

`AnthrazitClient` shares category, location, session, upload and wizard handling
for Winterthur (BFS 230), St. Gallen (3203), Schaffhausen (2939), Dietikon (243),
Köniz (355), Frauenfeld (4566), Allschwil (2762), Wil (SG, 3427), Bottmingen (2767),
Moosseedorf (544), preparation-only Wetzikon (ZH, 121), and the deferred
Schlieren profile (247). Tenant IDs and hosts are pinned
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

const city = new AnthrazitClient('winterthur'); // choose a reviewed tenant; writes disabled
const service = new ReportService(city, new Store('./private-data'), {
  submissionEnabled: false,
  allowPaths: false,
});
const server = createServer(service);
```

Choose the adapter from the authoritative BFS result for the confirmed point,
not from user text or a category label. `requirements` checks the boundary and tenant location preflight, reusing a
validated exact-point result for at most 30 seconds during preparation.
`ReportService.submit` requests fresh requirements before its durable claim. Use the live category **name** in the input;
its current numeric category ID is resolved again inside the fresh send session.

The extra fields exposed by these tenants are:

- `report_title`: required, German, at most 100 characters (connector limit).
- `street`, `postcode`, `place`: optional issue address components, shown verbatim
  in the frozen preview and transmitted without guessing.
- `notify_updates`: optional `yes` or `no`; omitted means no email-update subscription.

There is no verified public lookup/tracking adapter. Duplicate search is explicitly
unavailable, and receipts cannot be linked to Zürich's public feed. An official
form fallback opens a blank form; it does not prefill or transfer the draft.

The ten older anonymous tenant profiles can be opted into controlled genuine-report validation with
`new AnthrazitClient('winterthur', fetch, { experimentalSubmission: true })`
**and** `ReportService`'s `submissionEnabled: true`. Show the complete preview,
all extra fields, photos and `terms_url`. Obtain explicit report approval and
acceptance of those terms, then pass the exact `accepted_terms_url` to the MCP
`submit_report` tool (or the fourth `ReportService.submit` argument). Existing
consumer interfaces that do not collect this consent cannot send these reports.
Schlieren ignores the experimental opt-in and remains preparation-only until its
completed final flow is established. None of these tenants is automatically enabled in
the private Civic application by adding this package.

## Failure behavior and verification still required

Every municipal POST, including location staging and photo upload, happens after
`ReportService` acquires its durable exclusive claim. Sessions and cookies are
isolated per attempt. Unknown form fields, off-origin destinations, unexpected
steps, login screens, changed terms and mismatched preview text stop progression.
Redirects never replay POST bodies; final-send redirects are not followed.

No success response has been verified. Even a completed experimental
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
Civic exposes reviewed anonymous tenants behind separate off-by-default preparation
flags and consumes a versioned core dependency. Schlieren remains excluded while anonymous completion
is unverified; no municipal login integration is planned.

`report_title` is marked `translate: true` in requirements so clients translate
it with the public description. Contact and issue-address fields must not be
sent for translation.

## St. Gallen and Schaffhausen variants — 15 October 2026

Anonymous GET requests exposed category, location, upload, details and final-form
templates in both municipalities. No login form appeared. No location/details
POST, photo upload or final send was made for these tenants; completed submission
and municipal acceptance remain unverified. Live adapter GET-only requirements
passed with eight St. Gallen categories and nine Schaffhausen categories.

| Contract | St. Gallen | Schaffhausen |
| --- | --- | --- |
| Tenant `apid` / `usid` / `usmid` | 4507051 / 572 / 4457 | 11652884 / 7226 / 4733 |
| Location response | `{"inbfs":true}` | numeric `distance`, from 0 to the configured limit 6580 |
| `checkoutofrange` | empty | empty |
| Additional location fields | `devicecoords[lat]`, `devicecoords[long]` | same |
| Contact fields | email only; no `telefon` control | same |
| Final `proceed` value | `true` | `true` |
| Terms page `apid` | 15080152 | 4385201 |

Both share Winterthur’s multipart image endpoint (`img`, one file per interaction,
15 MB) and required title, description, optional issue-address fields and optional
notification checkbox. Authoritative BFS validation remains mandatory before the
provider check. Location-response types and final hidden values fail closed on
contract changes. Device-coordinate fields stay empty for a manually selected
issue point; an issue position does not establish the resident’s current location.

`Requirements.contact_fields` lists supported optional `name`/`phone` fields.
An empty list means email only; omission preserves existing adapters’ behavior.
St. Gallen and Schaffhausen reject nonempty unsupported contacts rather than
silently dropping them. Consumer interfaces must hide unsupported fields and
show only data included in the frozen preview. All tenants still default to
preparation only, without verified public tracking.

Sources: [St. Gallen official wizard](https://m.stadt.sg.ch/index.php?apid=4507051&do=add),
[St. Gallen terms](https://m.stadt.sg.ch/index.php?apid=15080152),
[Schaffhausen official wizard](https://m.stadt-schaffhausen.ch/index.php?apid=11652884&do=add),
[Schaffhausen terms](https://m.stadt-schaffhausen.ch/index.php?apid=4385201).

## Dietikon, Köniz, Frauenfeld, Allschwil and Wil — 15 October 2026

All five reuse the existing BFS/device-coordinate profile, with the private
`telefon` contact textarea and `proceed=true`. Anonymous GET navigation exposed
category, location, upload, details and final templates without a login form.
The live adapter also passed authoritative Swiss BFS and provider `inbfs: true`
checks at each official default map centre. No form POST, photo upload or report
submission was performed. Template access does not prove final acceptance.

| Tenant key | BFS | Categories | `apid` / `usid` / `usmid` | Terms `apid` |
| --- | ---: | ---: | --- | --- |
| `dietikon` | 243 | 8 | 631378530 / 7619 / 6758 | 3397510 |
| `koeniz` | 355 | 5 | 1322436301 / 7745 / 6466 | 9287336 |
| `frauenfeld` | 4566 | 7 | 907518245 / 7535 / 7120 | 3670734 |
| `allschwil` | 2762 | 7 | 1207371969 / 7913 / 6318 | 13012430 |
| `wil` | 3427 | 8 | 1491079142 / 7849 / 6728 | 12267455 |

Each form uses the shared multipart `img` upload endpoint (15 MB), optional issue
address, private contact text, email and optional update checkbox. The adapter
supports name/phone for these tenants. Dietikon advertises three files per upload
interaction; Civic deliberately retains the shared one-photo connector limit.
Frauenfeld's navigation-level user ID differs from its report module's user ID:
only the observed reporting IDs above are used for location and image operations.

Login-dependent municipalities are skipped. If any reviewed tenant starts asking
for login, the adapter stops; it neither authenticates nor retries the report.
No production direct submission or automatic tracking is enabled by these profiles.

Sources: [Dietikon wizard](https://dietikon.citymobile.ch/index.php?apid=631378530&do=add),
[Köniz municipal entry](https://www.koeniz.ch/wohnen/stadtmelder.page/1245),
[Köniz wizard](https://koeniz.citymobile.ch/index.php?apid=1322436301&do=add),
[Frauenfeld municipal entry](https://www.frauenfeld.ch/service/index.html/771),
[Frauenfeld wizard](https://frauenfeld.citymobile.ch/index.php?apid=907518245&do=add),
[Allschwil wizard](https://allschwil.mopage.ch/index.php?apid=1207371969&do=add),
[Wil municipal entry](https://www.stadtwil.ch/topics/wohnen/stadtmelder),
[Wil wizard](https://wilsg.citymobile.ch/index.php?apid=1491079142&do=add).


## Bottmingen and Moosseedorf — 15 October 2026

Both expose anonymous category, location, upload, details and final templates.
They reuse the existing device-coordinate controls, private `telefon` contact
textarea, multipart `img` upload (one file per interaction, 15 MB), optional
issue address/notifications and `proceed=true`. Device coordinates stay blank
for a manually chosen issue point. Each has eight live categories.

| Tenant key | BFS | Location response | `apid` / `usid` / `usmid` | Terms `apid` |
| --- | ---: | --- | --- | --- |
| `bottmingen` | 2767 | `{"inbfs":true}` | 1023155635 / 7948 / 6763 | 12513750 |
| `moosseedorf` | 544 | numeric `distance`, limit 4000 | 8554890 / 7320 / 4497 | 10627725 |

Bottmingen uses the existing BFS response variant. Moosseedorf combines the
existing distance variant with private name/phone support. Both also require
authoritative Swiss BFS validation, independent of the provider's check.
Inspection used GET only. No real upload, completed details or final send was
performed; completed anonymous submission and acceptance remain unverified.

A subsequent full live adapter recheck received HTTP 429 and an IP-rate-limit
CAPTCHA at both category pages. Live requests stopped without bypassing it.
Authoritative Swiss BFS lookups had passed, and replaying the previously captured
category/location GET responses through the adapter passed offline. This does
not establish current live availability; recheck it before enabling either route.
The connector stops on HTTP failures without retrying or solving challenges.

Aarberg, Büron, Sutz-Lattrigen and Bözberg presented login forms when inspecting
step 5 and are excluded from these profiles and the Civic registry. This is an
observed barrier in the incomplete anonymous flow, not proof of the behavior of
every completed report. No login integration or bypass is implemented.

Sources: [Bottmingen municipal app guidance](https://www.bottmingen.ch/de/verwaltung/dienstleistungen/225_app-4103bottmingen),
[Bottmingen wizard](https://bottmingen.citymobile.ch/index.php?apid=1023155635&do=add),
[Bottmingen terms](https://bottmingen.citymobile.ch/index.php?apid=12513750),
[Moosseedorf wizard](https://m.moosseedorf.ch/index.php?apid=8554890&do=add),
[Moosseedorf terms](https://m.moosseedorf.ch/index.php?apid=10627725).


## Traffic protection (v0.4.0-rc.6)

The adapter shares an in-memory `AnthrazitTraffic` controller for clients using
one fetch transport (the default in a single hosted process). It caches only
validated category arrays for five minutes and exact-point requirements for
30 seconds. Identical concurrent reads share one operation and receive separate
copies. Keys bind the service/municipality and unrounded coordinates. Cache size
is limited to 512 entries and 64 pending reads; expired entries are discarded on
the next read. No cookies, HTML, report text, contacts or photos enter the cache.
Coordinates remain in bounded process memory, not persisted or logged.

All Anthrazit requests, including every redirect/upload, share a maximum of two
active requests, a burst of eight starts and a refill of two starts per second.
At most 32 requests can wait, for at most five seconds. Idle requests start
immediately. These are conservative client limits, not verified provider quotas.

HTTP 429, explicit `ipcaptcha` forms, and HTTP 503 trigger a cooldown shared by
all users of the affected origin. Other municipal origins retain access to the
shared budget; an observed limit does not prove provider-wide blocking.
A valid Retry-After (seconds or HTTP date) is honored. Without one, rate limits
pause for five minutes and 503 outages for one minute, doubling on repeated
failures up to five steps. The backoff resets after an hour beyond the preceding
pause. `MunicipalServiceUnavailable` exposes `status: 503` and
`retryAfterSeconds`; consuming apps should keep the draft and display its message.
Fresh cached preparation data remains usable during a cooldown until it expires.
There is no background recovery probe, CAPTCHA solving, IP rotation or network
retry. Only a later caller can try again after the pause.

The optional `ReportingAdapter.requirements(point, { fresh: true })` contract
bypasses preparation caches; adapters without caches may ignore this argument.
`ReportService.submit` always uses it, and the wizard opens another isolated,
uncached session. A failure after the durable claim still records an unknown
outcome and forbids replay, including after the cooldown or a process restart.

When multiple fetch wrappers are necessary, explicitly pass the same
`new AnthrazitTraffic()` via each client's `traffic` option. Both controller and
error are exported from the package's `/anthrazit` entry point. Controller state
is process-local and resets on restart. Multiple workers or replicas require a
coordinated egress budget/cooldown before scaling; this implementation does not
establish multi-process protection. Obtain provider-agreed access and quotas
for production growth with a stable egress IP.

Verification uses mocked responses and a synthetic clock for cache isolation,
expiry, queue/rate bounds, Retry-After, challenges, fresh submission checks and
no replay. No real municipal requests, uploads or submissions were used for
these controls. See HTTP semantics: [429](https://www.rfc-editor.org/rfc/rfc6585#section-4)
and [Retry-After](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3).


## Wetzikon ZH preparation — 16 October 2026

The [municipal utility instructions](https://www.wetzikon.ch/stadtwerke/stoerungsmeldung/)
link to [WetziMelder](https://m.wetzikon.ch/index.php?apid=464979004).
Anonymous GET navigation in a preserved cookie session exposed seven categories,
location, photo, details and final templates. The documented boundary GET returned
`{"inbfs":true}` at the official map centre. This is one successful read observation,
not evidence that other Anthrazit tenants have recovered or that access is reliable
at public traffic volumes.

`AnthrazitClient('wetzikon')` binds BFS 121, tenant 7235, module 6871 and app
464979004. It uses live category names and IDs, authoritative BFS routing and
the tenant boundary check. Categories cover waste/collection points, open spaces,
praise/criticism, road damage/litter, graffiti, lighting/utilities and traffic/signs.
Emergencies remain excluded. The observed optional `sf[1]` lamp-number control is
exposed as `lamp_number`, limited to 80 characters by Civic. It applies only to
streetlights and is never inferred from location. The usual German title,
description, email, optional issue address, name/phone, notification choice and
one-photo preparation rules apply. The observed upload widget is multipart `img`,
one file per interaction and 15 MB.

This profile always has `submissionMode: 'unverified'`, including when experimental
writes are requested. It has no enabled write path or external-form completion.
The linked [terms](https://m.wetzikon.ch/index.php?apid=1873856) are frozen for review;
preparation is not consent. Real upload acceptance, completed anonymous submission,
municipal receipt and status linking remain unverified. No photo, location/details
POST or report was submitted. An operator test environment or genuine approved
report is required before enabling sending; source/template similarity is insufficient.
