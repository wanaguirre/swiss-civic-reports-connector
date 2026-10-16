# Bern and Fribourg preparation adapters

`MunicipalFormClient` (exported at `/municipal-forms`) implements anonymous
read/preparation for Bern (BFS 351, German) and Fribourg (BFS 2196, French).
It is **not a verified sending integration**. Its `submissionMode` is `unverified`;
`submit` always rejects before making a request. There is no experimental send
switch. Consumers must show preparation as unavailable for sending and must not
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
**No photo upload or municipal POST is implemented.** The form names are evidence
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
later review/final submission, photo limits/acceptance and receipt semantics are
unverified. No POST or upload was attempted, including first-step validation.
This adapter inspects public metadata and prepares locally; it has no write
transport and cannot be enabled for sending with a global switch.
