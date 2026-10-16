# Bern and Fribourg preparation adapters

`MunicipalFormClient` (exported at `/municipal-forms`) implements anonymous
read/preparation for Bern (BFS 351, German) and Fribourg (BFS 2196, French).
It is **not a verified sending integration**. Its `submissionMode` is `unverified`;
`submit` always rejects before making a request. There is no experimental send
switch for Bern or Fribourg. Consumers must show preparation as unavailable for sending and must not
substitute an external-form completion step for a confirmed municipal receipt.

## Verified form structure, 15 October 2026

- [Bern](https://www.bern.ch/helfen/@@damagereport): the observed handler is readable;
  categories come from its live selector. Email, location and category are marked
  required; one optional photo. Name/phone are not fields. Street-light faults go
  to ewb and are excluded. Its reporting script returns 403 to direct reads, while
  the browser form and handler GET remain usable. Write acceptance is unknown.
- [Fribourg](https://www.ville-fribourg.ch/on-repare): one defect category; name,
  email, reporter postal address/postcode/locality, issue address and description
  required. Phone and one photo are optional. A CAPTCHA on the separate feedback
  form is not a report requirement. Upstream Drupal supports managed-file uploads;
  the deployed upload/confirmation configuration is not verified.

Exact BFS validation precedes form lookup for requirements. Parsing is scoped to
the observed form, validates its fixed destination and field structure, and fails
closed on login, CAPTCHA, changed fields or ambiguous categories. Read responses
are bounded to 1 MB and 20 seconds; redirects are rejected. Validated public
metadata is cached for five minutes, concurrent reads coalesce, and errors pause
new reads for at least five minutes, honoring longer Retry-After values. No HTML, cookies, session tokens or personal fields
are cached. Fresh requirement requests bypass cached metadata.

Civic's shared importer normalizes local photos and removes metadata; preparation
limits attachments to one and freezes their hashes with the municipal destination.
**No photo upload or municipal POST is implemented for Bern or Fribourg.** The form names are evidence
for completing that transport later, not proof that a submission works.

The contract tests use sanitized read-only form fixtures and fictional local
photos. They verify required fields, one-photo limits, geographic/destination
isolation, schema drift, read bounds/cache and the unconditional sending guard.
No production municipal writes or real report acceptance were tested.

## Remaining delivery work

Capture the real upload/submission/receipt contract using an operator sandbox or
a specifically approved genuine report. Implement its transport through the
shared immutable-preview and durable duplicate-protection flow, with mocked
failure/redirect/session tests, before enabling it. Drupal's generic confirmation
markup, an HTTP 200, or an upload ID does not establish receipt. There is no
verified public tracking endpoint for either municipality.

## Ebikon — 16 October 2026

`new MunicipalFormClient('ebikon')` prepares German reports for BFS 1054 using
its [official OneGov form](https://www.ebikon.ch/form/schaden-melden).
Eight observed classes: signs, benches/bins, playgrounds/sports facilities,
green spaces/trees, waterways, toilets, public properties and other damage.
The [official forms index](https://www.ebikon.ch/forms) directs streetlight faults
to CKW separately; do not route them through "other damage".

Required first/last name and email; phone and one photo are optional. The exact
issue location label is limited to 150 characters and description to 400.
"Other damage" additionally exposes an optional translated type field.
Anonymous GET returned the multipart first step, CSRF token and empty honeypot,
with no active CAPTCHA or municipal login requirement. The page's unrelated login
link is not a reporting requirement. The first submit control is **Weiter**;
the initial inspection did not exercise the later steps. The subsequent public-source
review below establishes the platform contract, while deployed acceptance is still
unverified. No municipal POST or upload was attempted.

## Meggen and OneGov experimental transport — 16 October 2026

`new MunicipalFormClient('meggen')` prepares German infrastructure-safety reports
for BFS 1063 using [Meggen’s official form](https://www.meggen.ch/form/meldung-sicherheitsproblem).
Its single class is `Meldung Sicherheitsproblem`, handled by Planning / Construction;
exclude emergencies, police reports, general complaints and the separate lighting
route. First name, last name and email are required; phone and an issue address /
parcel are optional. Civic requires a confirmed issue location and description,
and permits one normalized JPEG up to 5 MB. The same conservative photo cap now
applies to Ebikon. Report scope and field definitions are shared with clients/AI.

Both live forms advertise OneGov Cloud 2026.52. Public upstream source at
[ef2496d446a2e0cb56f17e1296e0f97560f44ce0](https://github.com/OneGov/onegov-cloud/tree/ef2496d446a2e0cb56f17e1296e0f97560f44ce0)
provides the anonymous contract in `org/views/form_definition.py`,
`org/views/form_submission.py`, `town6/templates/submission.pt`,
`town6/templates/macros.pt`, `town6/templates/ticket_status.pt` and
`core/converters.py`. OneGov is MIT licensed; Civic’s independent HTTP client does
not vendor its implementation. Footer version matching does not verify the deployed
server or successful municipal delivery.

The library option `{ experimentalSubmission: true }` is accepted **only** for
Ebikon and Meggen. It is off by default and the consuming Civic app never passes it.
A global submission setting or coverage flag cannot unlock it. When used for an
approved genuine pilot through `ReportService`, the adapter:

1. Validates municipality, frozen destination, expiry, fields and photo hash.
2. Gets a fresh anonymous form/session, then uploads the approved payload once.
3. Follows only the exact same-origin pending-preview route. Every echoed field
   and the uploaded filename must match before the completion POST is sent.
4. Requires an FRM number, correct form subject and ticket state on the expected
   `/ticket/FRM/<32-hex-id>/status` response. Upload/preview/HTTP 200 alone is not
   acceptance. The ticket’s unguessable link is stored in the private receipt.

Requests are bounded and never retried. Errors after the first POST are `unknown`;
the durable send claim prevents recreation/replay. A first POST itself persists
pending data, even without completion. Cookies remain in an isolated temporary jar.
Provider Retry-After values pause subsequent attempts. The optional personal-data
email-copy checkbox is omitted; upstream still sends a ticket-reference email.
Automatic tracking is unsupported; the official ticket link supports manual viewing.

Contract tests use local fixtures and mocked responses, including tampered echoes,
redirects, missing receipts, uncertain writes, photos and durable duplicate protection.
No municipal write was performed. A genuine approved pilot or operator sandbox
must validate actual photo arrival and receipt before application rollout.

## Gossau ZH — 16 October 2026

`new MunicipalFormClient('gossau')` prepares `Problem melden` reports for **BFS 115**
(Gossau ZH, not Gossau SG) from its [official form](https://www.gossau-zh.ch/problem-melden/).
Scope: non-emergency public infrastructure, including bus stops, streetlights and
public noticeboards. Required: title, description, issue street/address and
postcode/locality, user-chosen salutation, first/last name, ten-digit phone and
email. One photo is optional. Civic's local caps are 5 MB/photo, 100 characters for
title/names, 5000 for description and 250 for each location field.

The read-only parser validates Ninja Forms 3.15.5 / Uploads 3.3.35, form 7,
14 field identities/types/order, required fields, phone mask, salutation choices,
photo constraints and the two policy links. It reads JSON literals without executing
scripts. It discards session tokens and fails closed on a changed contract.
`gossauRequirements()` is exported for consumers and offline fixtures.

The preview links to the official form containing both AGB and privacy terms;
preparation grants no consent. Contact extras stay separate from AI report text.
The source-reviewed upload uses `nf_fu_upload`, followed by `nf_ajax_submit`, but
**this adapter has no upload or submission transport**. Generic plugin success,
`save.sub_id` and `email.sent` do not verify the deployed recipient, attachment
arrival or municipal acceptance. No public tracking route is established.
Neither a global send switch nor `experimentalSubmission` can enable Gossau.
A genuine approved report or operator sandbox must establish delivery and receipt
before implementing and enabling that transport. All regression writes are mocked.
