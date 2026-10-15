# Signalements-Riviera adapter

`RivieraClient` and `rivieraMunicipalities` are exported from the package root and
`/riviera`. Profiles cover Blonay - Saint-Légier (5892), Chardonne (5882), Corseaux
(5883), Corsier-sur-Vevey (5884), Jongny (5885), La Tour-de-Peilz (5889), Montreux
(5886), Rennaz (5412), Vevey (5890) and Veytaux (5891). Delivery text is French.

**Preparation and a local multipart builder are implemented. Live sending is
unavailable.** `submissionMode` is `unverified`, and `submit()` always rejects
before any request. There is no switch that unlocks it, no fabricated receipt and
no external-form completion workflow. Consumer applications must opt in separately.

## Contract evidence

The [official service](https://www.signalements-riviera.ch/) and its
[anonymous form](https://www.signalements-riviera.ch/nouveau.php) were inspected
on 15 October 2026. One category read at a public settlement point in each of the
ten municipalities returned the matching zone. No live upload or submission was
made. The form posts a single optional photo, description, optional email, LV95
coordinates and a municipality/category ID to `add_signalement.php`.

Seven maintenance themes are allowlisted by both ID and observed name: public
lighting, pipe leaks, playgrounds/benches, signage, construction safety, pine
processionary caterpillars and abandoned bicycles. Harassment and unknown/internal
themes are excluded. Rubbish, noise and road-surface complaints are outside scope.
Provider instructions, including bicycle criteria, are returned as plain text.

The official BFS boundary is checked before provider reads. Coordinates use the
same [projection definition](https://www.signalements-riviera.ch/common/js/proj4js/epsg2056.js)
and integer truncation as the frontend, using pinned Proj4js. Provider zone names
must independently match the profile. General category IDs are not submitted:
`gid_zone_thematique` is resolved at the exact projected point.

Preparation reads the form, categories, public-parcel status and location context.
A missing public-parcel match produces a warning rather than implying that all
private locations are eligible. The current extra-attributes endpoint returned an
empty HTTP 200 body at the Vevey reference point; only that endpoint accepts empty
content as no enrichment. Nonempty responses must match its observed feature
shape. Meaningful context is prefixed to the description **before** the preview is
frozen, counted within the 1,000-character limit and checked again by the builder.
Changed context requires a new preview. Photos are limited to one without silent
truncation. Name and phone are unsupported; email is optional for this provider.

## Local payload construction

`await city.buildSubmission(prepared)` rechecks public metadata and returns
`{ url, method: 'POST', body: FormData }`. It does **not** dispatch the request,
upload a photograph, create a durable send claim or interpret acceptance. It is
for local contract validation and future transport implementation; it is not
connected to Civic's Send action. It rejects mismatched destinations, changed
context, unsupported fields, excessive text/photos and modified photo bytes.
Normalized JPEG bytes are attached directly to the multipart body; there is no
separate remote upload step in the observed form. The UI-only disabled `zone`
field is omitted. An empty optional email is omitted.

A future transport must be dispatched only through `ReportService` after exact
preview approval and a durable duplicate claim. Its live attachment acceptance,
success/error response, receipt identifiers/links and reconciliation behavior
still need an operator contract/sandbox or a genuine specifically approved pilot.
HTTP 200, a redirect or a locally built payload is not proof of delivery. Timeouts
must remain unknown and must never trigger an automatic resend. Do not enable all
ten profiles for delivery solely on the strength of one municipality's pilot.

## Read traffic and tests

Public reads have a 20-second timeout, reject redirects and bound form/JSON bodies
to 1 MB/100 kB. All profiles using the same fetch transport share a five-minute
cache, up to 128 public responses and 16 in-flight requests; identical reads
coalesce. Read failures pause requests for at least five minutes and honor longer
Retry-After values. Fresh checks bypass cached responses. No report content,
photos, contacts or cookies are transmitted during preparation.

Mocked tests cover all ten profiles, independently checked coordinate conversion,
municipality/category isolation, one-photo payloads, optional email, context/length
limits, form drift, cooldown, photo integrity and unconditional sending guards.
These tests do not establish production access quotas or municipal acceptance.
