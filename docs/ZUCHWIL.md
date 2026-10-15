# Zuchwil Weblication adapter

`ZuchwilClient` is exported from the package root and `/zuchwil`. It prepares
German damage reports for Zuchwil (BFS 2534) using official Swiss municipal
boundaries. Its mode is always `unverified`: neither a global submission switch
nor a consumer flag can enable sending. No municipal account or external-form
completion is implemented. Public report lookup, receipt links and tracking are
unavailable.

## Observed contract — 16 October 2026

The [official anonymous form](https://www.zuchwil.ch/de/verwaltung/formulare/schadensmelder.php)
and its upload iframe were inspected with GET only, using ordinary same-origin
session cookies. The iframe requires those cookies, not a resident login.
The public [uploader source](https://www.zuchwil.ch/weblication/grid5/gui/scripts/uploader.js?av=c40531)
and [request helper](https://www.zuchwil.ch/weblication/grid5/gui/scripts/grid.js?av=c40531)
describe multipart upload chunks, a URL-encoded POST preflight (including an image
byte prefix) and a mutating finalization GET. None was dispatched. The generated
form action, hidden form token, visitor ID and upload CSRF token are session-bound.

Civic requires the reviewed title, description, exact issue address and email.
Name and phone are optional and are labelled within the municipal remarks field.
There is one `Schadensmeldung` category; the form has no category selector.
One optional normalized JPEG up to 5,000,000 bytes is supported by the local
builder. This conservative limit is not a verified server acceptance guarantee.
The [privacy URL](https://www.zuchwil.ch/de/datenschutz/) is frozen in the preview;
merely preparing a draft does not accept it. The final address field combines
the reviewed location label and the preview's WGS84 coordinates.

## Reads and local plans

Preparation validates the scoped form and literal widget configuration without
evaluating third-party JavaScript. Unknown fields, destinations, login/challenges,
session mismatches and changed privacy requirements fail closed. Reads are bounded,
do not follow redirects, have a timeout and cooldown, and do not retry. Only a
five-minute verification result is cached; HTML, cookies and tokens are discarded.
Public geographic checks send coordinates to swisstopo as in other adapters.

`buildSubmission(preview, acceptedTermsUrl)` is a **local contract planning API**,
not an executor or an approval mechanism. It requires explicit privacy acceptance,
the matching preview destination, an unexpired preview and intact photos, then
reads a fresh isolated form session. The returned `ZuchwilSubmissionPlan` contains
upload preflight/chunk descriptors, an optional finalization descriptor and a
`buildForm(uploadedFilenames)` function. It expires after at most five minutes.
Plans contain sensitive session data and photo bytes: never log, persist, send to
the browser, or reuse them across reports/residents. There is no executor wired
to this API. Future dispatch must preserve ReportService's explicit preview
approval and durable duplicate claim before any write, including preflight.

`zuchwilUploadedFilename` validates the filename marker described by the public
source. It does not establish upload assembly or report acceptance. No municipal
success/receipt parser is invented. Preflight permissions, actual upload assembly,
finalization, report validation, acceptance and a receipt/reconciliation contract
still need an approved genuine report or an operator-supported test contract.
All test upload data is synthetic and all network traffic in tests is mocked.
