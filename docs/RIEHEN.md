# Riehen preparation adapter

`RiehenClient` (root export and `/riehen`) supports BFS 2703, in German, with
`submissionMode: unverified`. No configuration enables sending or external-form
completion. No fake reports, upload preflights, files, finalization requests or
validation POSTs were sent. Public report lookup and receipts remain unverified.

## Report classes

| Class | Civic attachments | Required details |
| --- | --- | --- |
| Municipal infrastructure damage | None | Description, exact confirmed public issue location |
| Graffiti on public property | One optional normalized JPEG, fewer than 2,000,000 bytes | Affected street, one surface, reporter/owner role, description and confirmed public issue location |

Both require first name, last name, home street/number, postcode, home town,
phone and email. Home and issue addresses remain separate. Civic requires the
resident to confirm public ownership and never guesses it from a photo. Private
property graffiti is excluded. Graffiti uses the reviewed first/last name and
email again for its reporter/owner contact fields; Civic supports one person and
one affected surface per report. The category's `scope`, `notes` and structured
requirements are public definitions for AI and resident interfaces, not contact
values. Consumers can retain analysis photos separately only with an explicit
attachment choice; the immutable preview must contain exactly the chosen photos.

## Observed contract — 16 October 2026

The [official form](https://www.riehen.ch/verwaltung/formulare/meldung-schaeden.php)
and its upload iframe returned HTTP 200. Form controls, conditional ancestry,
privacy links and literal uploader configuration are validated without executing
municipal scripts. Unknown controls, categories, altered branches, protection
widgets and unsupported destinations fail closed.

The deployment uses Weblication version 20. Its public
[uploader](https://www.riehen.ch/weblication/grid5/gui/scripts/uploader.js?av=07a92b)
and [request helper](https://www.riehen.ch/weblication/grid5/gui/scripts/grid.js?av=07a92b)
describe URL-encoded preflight, multipart chunks and a finalization GET. Unlike
the observed Zuchwil version, Riehen does not add `wcsrf` to preflight or
finalization; its chunk requests do use it. No such request was dispatched.
The widget permits larger images, but Civic enforces the outer form's stricter
published limit of **less than 2 MB** and one image.

Riehen sends an ephemeral `WSESSIONID` hidden form field, separate from its
upload visitor ID. The observed GET response set ordinary load-balancer cookies
and no WSESSIONID cookie. The reader preserves received cookies, does not invent
cookies, and rejects a contradictory WSESSIONID cookie if one is supplied.
Zuchwil retains its separate mandatory WSESSIONID-cookie contract. Reads use
bounded bodies, timeouts, concurrency limits, coalescing, a five-minute metadata
cache and cooldown; no automatic retries or cross-resident session reuse.

## Local plans and remaining verification

`buildSubmission(preview, acceptedTermsUrl)` only reads a fresh anonymous session
and constructs private request descriptors. It checks destination, expiry,
required choices, reviewed contact details, photo identity/hash/size and terms.
The form URL is the consent reference because it links **both** the
[privacy policy](https://www.riehen.ch/datenschutz/) and
[usage terms](https://www.riehen.ch/datenschutz/nutzungsbedingungen.php).
It is frozen in the preview; preparation does not accept either policy.

Plans include sensitive tokens and photo bytes. Never persist, log or expose
plans through a client API. They expire after at most five minutes. There is no
executor, success parser, invented receipt or automatic fallback. Future writes
must use ReportService's explicit preview approval and durable submission claim
before any upload/preflight. Actual upload assembly, form acceptance, receipt
identity and safe reconciliation require an approved genuine report or an
operator-supported test contract. A successful GET is not proof of delivery.
