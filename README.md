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
Wil (SG), Bottmingen, Moosseedorf, preparation-only Wetzikon (ZH), and the deferred Schlieren profile.
Their category/location reads are verified; municipal acceptance is not.
Wetzikon has no enabled sending or external-form completion. Schlieren direct sending remains unavailable; no municipal login is implemented. This is an independent,
unofficial project. Direct submission is experimental and **off by default**;
the official municipal form is the fallback. A real Telegram exchange and an
accepted municipal submission still need verification; passing tests do not
establish those live journeys.

The shared package also includes disabled [Bern/Fribourg preparation adapters](docs/MUNICIPAL-FORMS.md).
They collect the observed fields but cannot send; actual uploads and municipal receipts remain unverified.

Essertines-sur-Yverdon (BFS5520) adds GET-only local preparation for confirmed
municipal voirie infrastructure. Required private names/email/phone stay outside AI;
postal contacts are optional, photos excluded. Privacy terms and native acceptance
remain unqualified and explicitly disclosed. Three pinned public sources, including
robots policy, use shared ten-second starts. No client execution or sending.
See [municipal forms](docs/MUNICIPAL-FORMS.md).

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

### v0.4.0-rc.12 — Gossau ZH preparation

Adds opt-in Gossau ZH preparation with exact field/phone validation, public scope,
private contact fields, one photo and linked terms. Sending is unconditionally
disabled; no municipal writes or real receipts were verified. See
[municipal forms](docs/MUNICIPAL-FORMS.md#gossau-zh--16-october-2026).

Val-de-Charmey (BFS2163) supports disabled local preparation of anonymous public-space
reports. It requires title, description, exact municipal location, responsibility
confirmation and an explicit local choice about public publication. The official
form has no reporter contact controls or category selector. One optional normalized
JPEG up to 5 MB is a Civic limit. No sending, external completion or tracking.

Wünnewil-Flamatt (BFS2309) has preparation-only municipal streetlamp support through
`MunicipalFormClient('wuennewil-flamatt')`: four damage choices, separate reporter
and affected addresses, required personal/mobile phone, optional email/lamp number,
no photos. All four published form steps and their conditional data are pinned.
Sending, external completion and tracking remain unavailable.

Lungern (BFS1405) has source-pinned preparation through its municipal
Mängelmelder: eleven reviewed defect classes, required names/email and precise
location, and one optional local photo. Its four metadata POSTs are named
configuration queries with no resident/report data. Sending, external completion
and tracking remain unavailable; see [the contract](docs/MUNICIPAL-FORMS.md#lungern--municipal-mängelmelder-18-october-2026).

Stäfa and the fourteen independently qualified CKW lighting profiles reject
reporter email because their supported forms have no email control. Account email
is excluded from preparation; optional email on other supported forms is retained.

Scuol (BFS3762) has GET-only text preparation through
`MunicipalFormClient('ee-engiadina-scuol')` for public streetlights maintained by
EE Energia Engiadina. Exact point, municipality, provider responsibility, street
and one published fault choice are required; contacts are optional and photos
excluded. No Antibot execution, sending, external completion or tracking. See the
[Scuol contract](docs/MUNICIPAL-FORMS.md#scuol--ee-energia-engiadina-lighting-bfs3762-19-october-2026).

Thusis (BFS3668) has GET-only local preparation through
`MunicipalFormClient('thusis')` for damage to confirmed municipal leisure facilities.
A location, description and local photo are required; reporter contacts are excluded.
No municipal upload or sending is implemented. See the
[Thusis contract](docs/MUNICIPAL-FORMS.md#thusis-leisure-infrastructure-damage-bfs3668-18-october-2026).

Falera (BFS3572) has source-pinned text preparation through
`MunicipalFormClient('falera')` for nonurgent municipal public-works questions and
problems. Combined name, email and comment are required; private postal contacts
and phone are optional. Confirm the actual public asset and responsibility, exclude
photos, and keep sending, external completion and tracking disabled. See the
[Falera contract](docs/MUNICIPAL-FORMS.md#falera--municipal-works-questions-and-problems-18-october-2026).

### Rabiosa Energie: Churwalden lighting preparation

`rabiosa-churwalden` binds BFS3911 and an actual public lamp maintained by Rabiosa
Energie. The dedicated form requires street and locality; lamp number, description
and all reporter contacts are optional in the source. Civic adds a useful description,
maintained-asset confirmation and local length caps. Preserve real lamp numbers,
including leading zeros. Contacts remain private; photos are excluded.

The complete selected accordion and all 27 scripts are pinned. Only strictly shaped
read-time request-token and trap-name/value strings are discarded. No trap swapping,
client/protection execution, POST payload, external completion or tracking is
implemented. Preparation is GET-only; global and experimental switches cannot enable
sending. Exact public-lamp responsibility still requires confirmation; boundaries
do not verify ownership. An uncertain outcome never permits retry, recreation or
another channel. The consuming Civic flag remains false.

## Aarau species preparation (core 0.4.0-rc.60)

The shared `hornet-aarau` profile prepares individual suspected Asian-hornet sightings
within Aarau through its explicit national-platform referral. Actual date/point,
private names/email, consent and a local normalized photo are required. Eight public
source fingerprints are checked with GET only; no provider client, contact lookup
or sending is implemented. Nest/hive/privileged workflows remain outside this first
profile. See [requirements and limits](docs/MUNICIPAL-FORMS.md).

## Gränichen utility lighting preparation (core 0.4.0-rc.61)

`tbgraenichen` prepares only actual TB Gränichen public-lamp defects in exact BFS4006.
Street/number and private split names, phone and email are required; lamp number is
optional and photos excluded. Complete form/scripts and the CMS client are checked
by GET only. No native client, reCAPTCHA, sending, external completion or tracking.
Provider sharing/retention and durable acceptance remain unresolved. See
[requirements and limits](docs/MUNICIPAL-FORMS.md).

## TBS Suhr lighting preparation (core 0.4.0-rc.62)

`tbs-suhr` prepares nonurgent faults of actual TBS-maintained public lamps in exact
Suhr BFS4012. Private names/address/email/phone/contact method stay separate from
the actual lamp address and real fault date/time. Native public-lighting scope,
nonurgent priority and ownership confirmation are explicit; photos excluded.
Full builder/scripts and form/interaction/privacy sources are read and pinned with
GET only. No interaction simulation, provider execution, POST, sending or tracking.
See [requirements and limits](docs/MUNICIPAL-FORMS.md).

Windisch public streetlamp preparation is available as `rwb-windisch` (BFS4123).
Only actual EW Windisch public lamps under RWB operation qualify; exact location
and maintained ownership are required. Text only, private full contacts/address
and privacy acknowledgement; no sending, external completion or tracking.
See [municipal form constraints](docs/MUNICIPAL-FORMS.md).

Egliswil TB Seon lamp preparation is available as `tbseon-egliswil` (BFS4195).
It supports only the native telephone-contact subset for actual maintained public
lamps and genuine EWG plate lines. Private names/address/phone stay outside AI;
email and photo attachments are excluded. Five complete source pins and ten-second
shared pacing fail closed. Native reCAPTCHA/client/state execution and all sending
remain unavailable. See `docs/MUNICIPAL-FORMS.md` for scope and privacy limits.

SWL Staufen (`swl-staufen`, BFS4210) supports telephone-only local preparation for
confirmed maintained public lamps. Five fixed source checks fail closed; private
contacts remain outside AI. No postal address/email/photos, native client/state/
hCaptcha execution or sending. The hCaptcha/reCAPTCHA privacy discrepancy and real
acceptance remain unresolved. See [municipal forms](docs/MUNICIPAL-FORMS.md).

Elektra Auw (`elektra-auw`, BFS4223) supports local text-only lamp preparation with
private combined name/address/phone outside AI. Five raw source pins fail closed;
no email/photos, native client/state execution or sending. See municipal forms.

Obermumpf BFS4256 has `obermumpf-lighting` local preparation for confirmed municipal
public lamps. Private names, full address, phone and email remain outside AI. Lamp
number is optional; no photos. Exact geography precedes five paced source reads.
No client/state/trap execution, sending, external completion or tracking.


Zofingen (`zofingen-infrastructure`, BFS4289) adds default-off local preparation for six native municipal-infrastructure categories. Private combined name, daytime phone and email remain outside AI; observed date, asset street/number and description are required, building optional. Native photos are optional; this local subset accepts none. Exact municipality/point precedes five paced source reads. Full builder/all-script fingerprints retain stable state and discard only checked read-time shapes. Works, privacy and inert form clients are pinned; drift and failures stop cached peers. No client/state/trap/challenge execution, native payload, POST, upload, sending, external completion or tracking. Municipal acceptance remains unverified; uncertain outcomes must not trigger retries or channel switching. Privacy-read and asset confirmations, ISO nonfuture date and text caps are local requirements, not native consent.

Grandson VD (BFS5561) also has source-pinned local telephone-note preparation
through `MunicipalFormClient('grandson-voirie')`: exact municipal asset and point,
no reporter contacts or photos, no native payload, sending or tracking. The
published works fault invitation supports preparation only; native requirements,
incident privacy and acceptance remain unverified. See [contract details](docs/MUNICIPAL-FORMS.md).

## Crissier SIE lighting note

`MunicipalFormClient('sie-crissier')` prepares a local French telephone note for
a nonurgent fault of a confirmed SIE-maintained municipal luminaire at an exact
BFS5583 point. Provider instructions explicitly name Crissier, Chavannes, Écublens
and Renens; this profile only covers Crissier. One-to-six-digit real lamp number
is optional; retain the actual location when unknown, never invent a number.

No reporter contacts/photos are collected. SIE asks callers to leave contacts;
the resident adds them in a separately chosen call. No anonymous acceptance claim.
Dedicated instructions/municipality phone0216315111 conflicts with FAQ0216315000,
preserved without resolution. Provider privacy claims Swiss storage/no foreign
transmission while listing processors and foreign-authority exceptions; no fixed
incident retention or absolute foreign-processing assurance. Fifteen-day repair
text is not a durable receipt. Five public policy/report/FAQ/mandate/privacy pins
share ten-second starts, strict MIME/UTF8/size/no-redirect/no-credential guards and
a permanent context stop on drift/failure before cached peers. No requests to the
stopped Crissier host or native/security clients. No calls, email, native payload,
sending, external completion or tracking; all send flags remain ineffective.
Never automatically retry, recreate or switch channels after uncertainty.

### SIE partner profiles

The same guarded provider contract now has distinct preparation profiles
`sie-renens` (Renens VD5591), `sie-chavannes` (Chavannes-près-Renens5627) and
`sie-ecublens` (Ecublens VD5635), alongside `sie-crissier` (5583). Each profile
binds its own exact BFS/service identity, scope, body and asset confirmation.
`sieMunicipalities`, `isSieMunicipality`, `sieScopeFor` and `sieConfirmation`
are exported; `sieRequirements(profile)` defaults to Crissier for compatibility.
All profiles share the same five provider-only source pins, ten-second pacing
and permanent failure context, including cached peers. No municipal host or
protected contact form is requested: Renens explicitly forbids ChatGPT-User,
and municipal contact CAPTCHAs remain untouched. The independent provider
mandate explicitly names all four lighting networks. No anonymous acceptance
claim, reporter contacts/photos, native payload, calls, email, sending, external
completion or tracking. Keep each consumer flag off by default.

## Rivaz communal drinking-water telephone note

`MunicipalFormClient('rivaz-water')` prepares only local text for a confirmed
nonurgent maintenance fault of an actual communal drinking-water asset at its
exact point in Rivaz VD5609. The water page invites calls about problems or
emergencies; this preparation explicitly excludes urgent situations, suspected
contamination/health concerns, outages, active leaks/flooding, immediate danger,
private plumbing, new connections and hydrant requests. No reporter contacts or
photos, native fields/payload/client, sending, external completion or tracking.
Phone reporter requirements/anonymous acceptance and incident retention/country/
receipt remain unknown. Four full-byte source pins cover robots, water, current
authority and privacy; the protected generic contact form is never requested.
Shared ten-second starts and context failure stops precede cached peer reuse.
Public-source drift pauses preparation; no automatic retry or channel change.

## Lavigny communal Molok telephone note

`MunicipalFormClient('lavigny-molok')` prepares only local text for a confirmed
nonurgent breakdown of an actual communal Molok at its exact point in Lavigny
VD5637. The municipal waste page explicitly asks residents to report breakdowns
to the administration or waste councillor. No emergencies/danger/fire/hazardous
waste, litter/illegal dumping/deposits outside containers, private bins,
access-card/fee disputes, waste identification or general roads/utility faults.
No reporter contacts/photos, native client/state/payload, sending, external
completion or tracking. Telephone requirements and anonymous acceptance remain
unknown; a disposal card does not establish a reporting login requirement.
Four full-byte robots/waste/authority/privacy pins share ten-second starts and
stop cached peers on failure. The policy allows request processing, Swiss web
providers, legal disclosure and possible foreign transfers; malformed policy
URLs/emails are never destinations. Incident retention/country/receipt unknown.
Newsletter antispam is retained in source bytes but never executed. No automatic
retry, recreation or channel change after uncertainty.

## Bussigny provider lighting telephone note

`MunicipalFormClient('bussigny-lighting')` prepares local French text for a
nonurgent fault of an actual Romande Energie public streetlight at its exact
Bussigny VD5624 point. The municipality transferred lighting in2020. Municipal
preferred email instructions (real mast number/address; recipient stays cloaked)
and the independently published provider lighting-only phone0800260000 remain
distinct. This is an initial optional phone note, never an automatic channel
change after a prior report. A visible mast reference is useful local context,
not a verified phone requirement. No urgent danger/wires/sparks, network/domestic
outages, private lamps, connections, billing, roads, water, drainage or pollution.
No contacts/photos/native client/state/payload, sending, completion or tracking.
Phone requirements/anonymous acceptance and incident privacy/retention/country/
receipt remain unknown. General policy allows group/provider/authority sharing
and possible international processing. Eight immutable robots/ownership/authority/
legal/provider/privacy URL/digest pins share ten-second starts and permanent
failure stops before cached peers. No copied municipal/provider text or bundles
in code/fixtures; independently authored verifier tests and private actual-capture
verification are separate from real municipal acceptance. No automatic retry.

## Saint-Sulpice VD communal lighting telephone note

`MunicipalFormClient('saint-sulpice-lighting')` prepares local French text only
for a nonurgent malfunction of an actual communal public streetlight at its
precise point in Saint-Sulpice VD5648. The municipality explicitly invites calls
to0216943350 or publishes literalgreffe(at)st-sulpice.ch. This is an initial
optional phone note; no reporter contacts/photos, native client/state/payload,
sending, external completion or tracking. No urgent danger/wires/sparks, network/
domestic outages, private lamps, connections, billing, general roads/water/drainage/
gas/pollution. Telephone requirements/anonymous acceptance and incident privacy/
retention/country/receipt remain unknown. Current2026–2031 authority body is
pinned despite its legacy2021–2026 URL. Five factual robots/works/voirie/authority/
lighting pins use the shared ten-second verifier and permanent cached-peer stop.
Own fixtures only. Protected generic contact/antispam/client/state never requested
or inherited. Never automatically retry, recreate or switch channels after
uncertainty. No invented privacy URL or native phone requirements.

## AVM water maintenance telephone notes

`avm-chigny`, `avm-clarmont`, `avm-echichens`, `avm-vaux`, `avm-vufflens`,
`avm-hautemorges` prepare local French initial optional call notes for nonurgent
maintenance faults of confirmed actual AVM communal drinking-water assets in
BFS5628/5629/5634/5650/5653/5656 respectively. Six explicit provider service names
and dedicated dépannage contacts are supported by Vaux's independent referral.
Main0796380181/substitute0799152487 are contextual, never automatic fallback.
No emergencies/active leaks/floods/contamination/health/outages/private plumbing/
connections/billing/hydrant use/general roads/lighting/wastewater. Exact boundary
and resident confirmation alone do not prove ownership. No reporter contacts/
photos, native form/client/state/consent/payload, sending/external completion/
tracking. Telephone requiredness/anonymous acceptance/incident privacy/retention/
country/receipt unknown; Vaux website policy does not govern AVM calls.
Six factual pins, own fixtures and a single strict shared verifier stop all six
cached peers after failure; ten-second shared starts and no retry. Municipal
robots/protected form/cartography stops preserved, no stopped host reads. Yens
staff address and historical Bussy-Chardonney do not add service geography.
Never automatically retry/recreate/change channel after uncertainty.

## Chavannes-sur-Moudon maintenance telephone notes

`MunicipalFormClient('chavannes-moudon-maintenance')` prepares local French
initial optional call notes for nonurgent actual communal road/path/signage or
public-lighting faults in exact BFS5665. Municipal fault invitations publish
0219056094 and request location. Each category has a distinct actual-asset
confirmation. Boundary/resident confirmation alone does not prove ownership.
Exclude immediate danger/active traffic risks/obstructions/wires/sparks/outages/
private assets/enforcement/neighbour disputes/water/drains/gas/pollution/graves/
inhumation/cards/fees. No reporter contacts/photos/native fields/consent/client/
state/payload, calls/email/sending/completion/tracking. Phone requiredness/anonymous
acceptance/incident privacy/retention/country/receipt unknown. Generic NinjaForms4
contacts/consent/native honeypot/client not inherited or requested. Authority term
not explicit; no broader AISTBV/AECLC/RE geography. Four factual robots/roads/
authority/legal pins share the strict ten-second verifier/permanent cached-peer
stop, own fixtures only. Copyright conditions preserved, no source copies.
Dedicated privacy URL referenced but unread. Never automatically retry/recreate/
change channel after uncertainty.

## Dompierre VD communal road telephone note

`MunicipalFormClient('dompierre-roads')` prepares local French initial optional
call notes for nonurgent physical maintenance faults of actual communal road
surfaces at exact BFS5671 points. The municipal voirie page explicitly invites
road reports to GuillaumeDiserens0788739737; actual2026–2031 authority confirms
responsibility. Boundary/resident confirmation alone does not prove ownership.
No danger/active traffic risks/obstructions/accidents/enforcement/cantonal/private
roads/assets/lighting/water/drainage/gas/waste/trees/billing. No reporter contacts/
photos/native fields/consent/client/state/payload, calls/email/sending/completion/
tracking. Phone requiredness/anonymous acceptance/incident privacy/retention/
country/receipt unknown, no invented privacy URL. Four factual robots/home/
services/authority pins share strict ten-second verification/permanent cached-peer
stops; own fixtures only, no municipal page copies. Planned lighting23–05off and
EauSud/AIR-PRO links do not establish road or lamp-fault coverage. Finance phone
display/href discrepancy remains separate. Never automatically retry/recreate/
change channel after uncertainty.

## Moudon local lighting worksheet

`MunicipalFormClient('moudon-lighting-note')` prepares a local French facts
worksheet for nonurgent faults of actual communal public streetlights at exact
BFS5678 points, with additional ownership/nonurgent confirmation. Ordinary faults
are directed to the online form; emergency telephone is not an ordinary fallback.
Local street-name/fault-kind rules are not native validation. Actual street/lamp
numbers are optional if unknown; never invent identifiers or replace them by zero.
This is not a complete official form. No contacts/photos/native consent/client/
state/payload/calls/email/sending/completion/tracking. Native contact/photo/privacy/
guest acceptance/receipt unknown; protected native host is excluded entirely.
Four factual main-host robots/authority/lighting/SI pins use the strict ten-second
verifier and permanent cached-peer stops; own fixtures, no copied pages/bundles.
No danger/wires/sparks/general outage/active traffic risk/private assets/enforcement/
accusations/water/gas/roads/drains/waste. Destruction describes visible nonurgent
maintenance facts only. Never automatically retry/recreate/change channel after
uncertainty. Source qualification:20October2026; no live submission verified.

## Vucherens local water telephone note

`MunicipalFormClient('vucherens-water')` prepares local French initial optional
telephone notes for nonurgent physical maintenance faults of actual communal
drinking-water assets at exact BFS5692 points with additional ownership/nonurgent
confirmation. Public water-network problem invitation: communal employee
0794464074. Authority body since1July2026 agrees despite old URL. No emergencies,
health/contamination, outages, leaks/flooding, private plumbing, new connections/
hydrant-use requests, roads/drains/lighting/gas/waste/billing. No contacts/photos/
native consent/client/state/payload/calls/email/sending/completion/tracking. Phone
requiredness/anonymous acceptance/incident privacy/retention/country/receipt unknown.
Four factual public robots/voirie/water/authority pins; strict ten-second verifier/
permanent cached-peer stops. Protected generic contact excluded; own fixtures, no
copied pages/bundles. Paid exceptional private services are not water-report fees.
Never automatically retry/recreate/change channel after uncertainty.

## Bassins local water maintenance-enquiry draft

`MunicipalFormClient('bassins-water-enquiry')` prepares local French enquiry facts
for nonurgent physical defects of actual communal drinking-water assets at exact
BFS5703 points, with additional ownership/nonurgent-enquiry confirmation. The
public water page invites distribution questions to commune@bassins.ch, with
possible municipal redirection to Renevier SA. This is not verified fault acceptance
or a telephone/native email adapter. Emergency contractor phones are excluded.
No contacts/photos/native consent/client/state/payload/emails/calls/sending/mail-
client launch/completion/tracking. Email requiredness/anonymous acceptance/incident
privacy/retention/country/forwarding/receipt unknown. Website account/message
periods and EU hosting do not establish email-incident guarantees. Four factual
public robots/water/authority/canonical-privacy pins, strict ten-second verifier
and permanent cached-peer stops; own fixtures, no copied pages or client bundles.
Term not explicit; CGU placeholder not actual terms. No emergency/health/outage/
leak/flooding/private plumbing/new connection/hydrant-use/other-service/billing
scope. Never automatically retry/recreate/change channel after uncertainty.

## Begnins SEIC local lighting facts worksheet

`MunicipalFormClient('seic-begnins-lighting-note')` prepares local French facts
for nonurgent nonworking/intermittent faults of actual communal public streetlights
at exact BFS5704 points, with extra actual-asset confirmation. Municipal SEIC
referral and lighting portfolio support this destination only. Provider form
choices Duillier/Prangins do not enable those municipalities. Repair requires a
municipal mandate. The protected reCAPTCHA provider form/client/state are excluded
from every source read and preparation; four fixed main-municipal-host factual
pins use the strict ten-second verifier/permanent failed-context cached-peer stop.
Local street-name/fault-kind rules are not native validation. Actual street and
mast numbers only if known; never invent identifiers or zero. The official form
also requires a street number, title, surname, first name and email: this worksheet
is incomplete and collects no reporter contacts/photos/consent. Native photo,
privacy, retention, country, guest acceptance and receipt remain unknown. No native
payload, calls/email/sending/external completion/tracking or ordinary emergency
phone fallback. No danger/wires/sparks/general outage/traffic risk/private assets/
other services. Never automatically retry/recreate/change channel after uncertainty.
Own logic/fixtures/factual digests, no copied municipal pages/client bundles.

## Duillier and Prangins SEIC local lighting facts

`seic-duillier-lighting-note` (BFS5715) and `seic-prangins-lighting-note`
(BFS5725) reuse the independently authored SEIC local worksheet rules with
separate point guards, ownership confirmation values, destination identities and
four municipal full-byte source pins each. Existing Begnins exports remain
compatible. Actual municipal SEIC relationships and current lighting responsibility
agree with the previously captured provider's explicit municipality choices.
No new provider/contact requests: protected forms, clients, native state and
payloads are excluded. Municipal pins alone are read by the bounded verifier.
Nonurgent actual communal streetlights, nonworking/intermittent only; unknown
street/mast numbers stay absent. The official form also needs street number,
title, surname, first name and email; the worksheet intentionally remains incomplete
and collects no contacts/photos/consent. Native photo/privacy/retention/country/
guest acceptance/receipt unknown. Repair requires municipal mandate, not guaranteed
acceptance. No calls/email/sending/completion/tracking or ordinary fallback.
Six electricity shareholder communes do not imply six lighting destinations.
Never automatically retry/recreate/change channel after uncertainty.

## Coppet local lighting facts

`coppet-lighting-note` (BFS5712) prepares an incomplete local French facts
worksheet for nonurgent defects of actual communal public streetlights. The
municipality explicitly invites lighting defects and assigns this service to
heritage and road maintenance; its contracted specialist is unnamed. Exact BFS
point and distinct communal-asset confirmation are required, street and observed
fault kind are local requirements, known street/lamp numbers stay absent when
unknown. Visible damage is material observation only, no accusations. Excludes
danger/wires/sparks/outages/active traffic risks/private assets/other services.
Four factual robots/directory/service/privacy pins use bounded full-byte source
verification, shared ten-second starts and permanent cached-peer failure stops.
Selected FriendlyCaptcha incident detail, client/schema/puzzle/state are excluded
from every runtime read. Native fields were not loaded: contact/photo/retention/
country/guest acceptance/receipt unknown; site statistics hosting does not
establish incident storage. No contacts/photos/consent/native payload/calls/
email/sending/completion/tracking. Never automatically retry, recreate or change
channel after uncertainty. No general office/provider/emergency fallback.

## Founex local lighting facts

`founex-lighting-note` (BFS5717) is an incomplete local French facts worksheet
for nonurgent nonworking/intermittent actual communal public streetlights.
The municipal FAQ explicitly invites lighting faults by email to travaux@founex.ch
with location. No automated mail transport is implemented. Exact BFS point and
distinct communal-asset/nonurgent confirmation, local street/fault-kind rules,
actual street/lamp identifiers only if known. No danger/wires/sparks/outage/
active traffic risk/private assets/accusations/other classes. Four fixed safe
robots/FAQ/composition/service-directory byte pins use bounded verification,
shared ten-second starts and permanent failed-context/cached-peer stops.
Protected maintenance reCAPTCHA form/client/challenge/state excluded; its
required surname/first name/email are not inherited into the explicit email
route. Email exposes sender metadata; contact/photo/privacy/retention/country/
acceptance/receipt unknown. No contacts/photos/consent/native payload/calls/
email sending/completion/tracking. Never automatically retry/recreate/change
channel after uncertainty; no staff/office/web/provider fallback.

## Romainmôtier-Envy local LED-lighting facts

`romainmotier-lighting-note` (BFS5761) prepares incomplete local French facts
for nonurgent nonworking/intermittent faults of actual communal public LED
streetlights. The municipal notice dated 2 September 2026 explicitly invites
LED problems and adjustment requests to cedric.rey@romainmotier-envy.ch with
location, observed problem and reasons for an adjustment. This first profile
excludes adjustment requests. No email preparation, transport or calls.

Exact municipality point and separate communal-LED/nonurgent confirmation are
required. Street and fault kind are local rules; real street/lamp identifiers
remain optional and absent when unknown, never invented or replaced by zero.
The notice names Cédric Rey; the directory lists Michel Chabloz for lighting
and Rey as substitute. Do not silently replace the explicit recipient or infer
a current executive term. Boundary confirmation alone does not prove ownership.

Five fixed raw URL/digest pins cover robots, the dated invitation on the home
page, authority, privacy and legal notice. Ten-second shared pacing and permanent
source-failure stops invalidate cached peers. Only factual paraphrases/digests
and own offline fixtures are distributed; no municipal pages, newsletter keys
or clients. Contact/newsletter/cookie/administrative clients and native state
are not executed or used as report requirements.

No contacts/photos/native consent/payload, sending, external completion or
tracking. Email sender metadata, identity/photo/privacy/retention/country,
anonymous acceptance and receipt remain unresolved. General site analytics
may process outside Switzerland; administrative-ID deletion rules do not apply
to email incidents. Never automatically retry, recreate or change channel after
uncertainty; no office, substitute, website, phone or provider fallback.

## Jorat-Menthue local Molok-access facts

`jorat-menthue-molok-note` (BFS5804) prepares incomplete local French facts
for nonurgent mechanical access failure of an actual communal underground
Molok at Montaubion-Chardonney (former dairy opposite college) or Sottens
(village square towards Moudon). The published waste page asks residents to
notify administration or the responsible official when underground-container
access is temporarily impossible. Administration publishes greffe@jorat-menthue.ch.

Exact municipality point, source-listed actual site and separate confirmation
of residency, a legitimately issued access card, actual communal asset and
nonurgent mechanical failure are local rules. Boundary/site choice alone do
not prove asset ownership/location. Other villages use compactors and are
excluded. Lost/invalid cards, billing, weighing, hazards and wider complaints
remain outside this first profile. No container operation, repair or dumping.

Five fixed raw URL/digest pins cover robots, home, waste, administration and
authority. Shared ten-second pacing and permanent source-failure stops
invalidate cached peers. General contact.php, native clients/state/schema/
validation and Ecowaste login remain unused. Only factual paraphrases, URL/
digests and independently authored fixtures are distributed.

No reporter contacts/photos/card numbers/account credentials/native consent/
payload/mail preparation/calls/email sending/completion/tracking. Unknown
actual container identifiers/time remain absent, never invented or zero.
Email sender metadata, identity/photo/privacy/retention/country/anonymous
acceptance/receipt requirements remain unknown; physical access cards are
not report login. Not a complete official form. Never automatically retry,
recreate or change channel after uncertainty; no office/member/substitute/
phone/provider fallback. AIEHJ water-network responsibilities are separate.

## L’Abbaye local lighting facts

`labbaye-lighting-note` (BFS5871) prepares incomplete local French facts for
a nonurgent nonworking or intermittent fault of an actual communal streetlight.
The official lighting page states municipal network ownership and asks residents
to contact the communal office at 021 564 20 33 or info@labbaye.ch for failures,
giving the village, street and candelabrum number if possible. The three source-
listed villages are L’Abbaye, Le Pont and Les Bioux. No LED technology is assumed.

An exact municipality point and separate confirmation of the actual communal
asset, real village and nonurgent failure are required. Boundary/village choice
alone do not prove ownership or lamp location. Village/street facts come from
the invitation; fault choices and limits are local worksheet rules, not native
validation. Actual lamp number only if known; unknown stays absent, never
invented or zero. Brightness/policy adjustments, planned extinction, private
assets, other services and immediate hazards are excluded.

Five fixed raw URL/digest pins cover robots, home, lighting, administration and
presentation. Ten-second shared pacing and permanent source-failure stops
invalidate cached peers. Contact form, native clients, state, schema, validation
and external providers remain unused. The published 2021–2026 executive roster
and October 2026 election notices do not establish a verified current term or
personal recipient. Only factual paraphrases, URL/digests and independent
fixtures are distributed.

No reporter contacts/photos/native consent/payload/mail preparation/calls/email
sending/external completion/tracking. Identity/photo/privacy/retention/country/
guest acceptance/receipt remain unknown; email exposes sender metadata. This
is not a complete official form. Never automatically retry, recreate or change
channel after uncertainty; no office/member/substitute/phone/provider fallback.

## Cuarny local perceived-water-quality facts

`cuarny-water-quality-note` (BFS5911, export `cuarny-form`) prepares an incomplete
local French facts worksheet for an independently confirmed nonurgent observation
about the perceived quality of actual Cuarny-supplied drinking water at its exact
point. The water page explicitly invites these observations to Jérémie Cartier;
the current2026–2031 authority page confirms his drinking-water portfolio.

Confirm actual local supply and an existing nonurgent factual observation. The
boundary does not prove supply, cause or safety. This is no diagnosis, clinical
report, sampling/testing advice, cause/ownership/public-asset-fault claim, safety,
drinkability or urgency conclusion. Health/contamination/illness concerns,
emergencies, outages, active leaks/flooding, private-plumbing repairs, billing,
new connections and other services are excluded. No clinical fields are requested.
The confirmation and text limits are local rules, not official requirements.

Five fixed raw URL/digest pins cover own robots, home, water invitation, current
authority and administration. Shared ten-second pacing (forty seconds cold),
1MB/MIME/UTF8 bounds and permanent failure before cached peers preserve the source
contract. The water comes from Sagenord since2022 and local sources are under
rehabilitation; neither establishes cause, ownership or completed works.
General contact, native clients/state/schema and external providers remain unread.
The published literal `(at)` email/hash link is not decoded, repaired or launched.
No municipal HTML, clients, native values or private reports are distributed.

No reporter contacts/photos/native consent/payload/mail preparation/calls/sending/
external completion/tracking, including global experimental flags. Official
identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain
unknown; no anonymous/Swiss-only/no-sharing guarantee. This is not a complete
official form. Never automatically retry, recreate or change channel after
uncertainty; no office/member/substitute/phone/provider fallback.

## Orzens local suspected-hornet observation facts

`orzens-hornet-observation-note` (BFS5925, export `orzens-form`) prepares only an
incomplete local French facts worksheet for an existing, independently nonurgent
suspected Asian-hornet individual/nest observation at its exact Orzens point.
The specific municipal notice names Frédéric Burkhard for announcements/questions;
the actual2026–2031 authority page confirms his current membership. His construction
portfolio does not establish species expertise or a removal mandate.

The required local confirmation preserves suspicion and uncertainty; it is not an
official form requirement or identification/safety/urgency conclusion. No approach,
capture, trap, bait or removal advice. Immediate/personal danger, medical or sting
concerns, removal requests, bees/other species and other services are excluded.
The existing internal `species_observation` kind imports no Aarau/native case kind,
reporter/photo fields, consent, client state or payload.

Five raw URL/digest pins cover own robots, specific home invitation, current
authority, greffe and general privacy. The unchanged shared verifier enforces
ten-second spacing (forty seconds cold),1MB/MIME/fatal UTF8 and permanent failure
before cached peers. All source data remain private; only factual URLs/digests and
original scope text are distributed. Generic contact and providers remain unread.

No reporter contacts/photos/clinical/native fields or consent, mail/call preparation,
sending, external completion or tracking, including experimental/global flags.
General info-email policy describes one-year retention and Swiss hosting in that
context; it does not qualify the individual recipient's identity/photo/privacy/
retention/country/forwarding/guest/receipt contract. No anonymous or Swiss-only
guarantee. Whitespace-bearing mailto is neither repaired nor launched. The specific
local invitation is independent, never a workaround or automatic channel change
after an uncertain platform report. Never automatically retry, recreate or change
channel; no office/member/substitute/phone/provider fallback. Release/canonical
consumer delivery remains separate from this draft source implementation.

## Suscévaz local suspected-hornet facts and announced merger

`suscevaz-hornet-observation-note` (BFS5930, export `suscevaz-form`) prepares
incomplete local French facts for an existing independently nonurgent suspected
Asian-hornet individual/nest observation at the exact current municipality point.
The actual municipal PDF asks announcements to the platform **and** commune.
Local facts fulfill neither announcement and replace neither channel. Known
platform restrictions remain binding; no platform contract or Aarau native fields
are imported, and no automatic duplication or fallback occurs.

The internal `species_observation` kind preserves uncertainty, with one local
confirmation rather than a verified native requirement. No identification,
safety/urgency/legal/removal conclusion or approach/capture/trapping/bait/removal
advice. Immediate/personal danger, medical/sting concerns, removal requests,
bees/other species and other services are excluded. No reporter contacts/photos,
clinical/native fields, consent, email/call preparation, sending, external
completion or tracking. General office correspondence does not qualify hornet
transport. Identity/photo/privacy/retention/country/forwarding/guest/receipt remain
unknown; no anonymity or hosting guarantee is inferred.

Five URL/digest pins cover robots, home, current authority, greffe and the actual
PDF notice. Optional PDF pins require `plain:false,pdf:true`, exact bytes and a
strict `%PDF-` signature, PDF MIME and a streamed1MB bound; binary data are never
UTF8-decoded, parsed or executed. Existing HTML/robots pins keep fatal UTF8 and
exact-byte behavior. Ten-second shared pacing and permanent failures precede cached
peers. Only factual URLs/digests and original scope text are distributed, not PDF
or municipal page bodies.

The announced1January2027 merger retires this profile at
`2026-12-31T23:00:00Z` (Zurich midnight), before cached preparation, between paced
reads and after verification. Retirement is irreversible for a fetch context,
including after clock rollback. Baseline identities stay separate; no future
merged identity/election result is inferred. Never automatically retry, recreate
or change channel after uncertainty; no office/member/substitute/phone/provider
fallback. Source implementation/local checks remain separate from exact public
release, canonical consumer delivery and verified sending.

## Villars-Epeney local communal-meter facts

`villars-epeney-meter-note` (BFS5935, export `villars-epeney-form`) prepares an
incomplete local French worksheet for a legitimate subscriber’s actual communal
water meter with an already observed, independently nonurgent mechanical defect
at its exact municipality point. Published articles14–15 describe the communal
rented meter and ask subscribers to notify the Municipality immediately of damage.
Local facts perform no notification, establish no legal compliance and extend no
deadline. One local subscriber/actual-meter/nonurgent-facts confirmation is not an
official field or account validation; point alone establishes neither ownership,
subscription nor a defect.

Exclude leaks, interruption/pressure or health/contamination concerns, private
pipes/valves or other assets, billing/accuracy disputes, connection/subscription
changes, and inspection/testing/handling/unsealing/dismantling/repair requests.
No new observation, reading, test, photo, manipulation or repair advice. No cause,
diagnosis, safety, urgency, legal, accuracy, tariff or billing conclusion. No reporter
contacts, customer/account/meter serial identifiers, photos, clinical/native fields,
consent, email/call preparation, sending, external completion or tracking. Official
identity/privacy/retention/country/forwarding/guest/receipt remain unknown.

Seven raw URL/digest pins cover robots, home, administration, the undated roster,
current regulation index, actual water regulation and separate2025 tariff annex.
The unchanged shared verifier checks PDF MIME, strict signature and exact binary
bytes under a streamed1MB bound, never parsing or executing PDFs; HTML/robots keep
fatal UTF8 and exact bytes. Ten-second shared pacing means sixty seconds cold;
permanent failures precede cached peers. Source bodies stay private. The old
embedded tariff annex is distinct from the published2025 annex, and no charge,
liability or legal-entry promise is made. The undated roster does not confirm a
2031 composition or individual intake mandate.

Never automatically retry, recreate or change channel after uncertainty; no office,
member, substitute, phone, contractor or provider fallback. Source implementation
and local consumer tests remain separate from authorized public release, canonical
consumer delivery and verified sending. All experimental/global send flags still
refuse this unverified profile.

## Yvonand local suspected-nest facts

`yvonand-hornet-nest-note` (BFS5939, export `yvonand-form`) prepares only local
French facts for an existing independently nonurgent suspected Asian-hornet NEST
at its exact municipality point. The published notice requires a platform
announcement AND commune information by email OR phone, accompanied by one or more
photos. This zero-attachment worksheet fulfills neither official announcement AND
leaves required photos unfulfilled. It is not a complete official form or an
alternative channel. One local factual/nonurgent/nest confirmation is not native
requiredness. No individual-only sightings, other species, immediate/personal
danger, medical/sting concerns or removal requests.

Describe only already observed facts and uncertainty. No new approach, inspection,
photo, filming, testing, handling, capture, trapping, bait or removal advice. No
identification, diagnosis, safety, urgency, medical, legal, eligibility, removal,
reimbursement or cost guarantee. The published municipal funding statement is
context, not a payment or intervention promise. No reporter contacts, photos,
clinical/native fields or consent; no mail/call preparation, sending, completion or
tracking. Native identity/photo-transfer/privacy/retention/country/forwarding/guest/
receipt remain unqualified. Known platform restrictions remain binding.

Six raw pins cover robots, home, administration, specific municipal nest notice,
actual opaque one-page PDF and current executive. The unchanged shared verifier
keeps strict PDF MIME/signature/exact bytes under1MB, fatal UTF8 for HTML and
permanent failure before cached peers; ten-second spacing means fifty seconds
cold. No PDF parsing/code execution; no merger retirement inferred. Source bodies
stay private. Internal species_observation is not a native platform case kind.
Never automatically retry, recreate or change channel after uncertainty; no office,
member, substitute, phone, contractor or provider fallback. Local source and
consumer tests remain separate from exact approved public release, canonical
consumer delivery and verified sending. All send flags refuse this profile.

## Simplon EVS meter-display local facts

`simplon-evs-meter-note` (BFS6009, export `simplon-form`) prepares German local
facts for a legitimate EVS customer’s actual EVS-owned meter and an ALREADY
OBSERVED independently established NONURGENT DISPLAY irregularity at the exact
point. Required local `evs_meter_observation_confirmed` is not account validation or
verified official requiredness. Point alone establishes none of these facts.
Regulation13.1 identifies utility meters;13.6 asks notification without delay.
This local worksheet performs NO notification, establishes NO legal compliance,
extends NO deadline and must not delay actual required notification. It does not
assess urgency or safety. It is not a complete official form or alternative channel.

No new approach, inspection, reading, testing, photo, handling, unsealing,
dismantling or repair requested. Exclude suspected electrical safety symptoms,
heat/noise/sparks/smoke/smell, damaged enclosure/seal/cable, outages/supply problems,
switching/control/fuse/cable devices, other assets, billing/accuracy/calibration,
connection/account changes, medical concerns and repair/removal requests. No
reporter contacts, account/customer/serial identifiers, photos, clinical/native
fields or consent; no diagnosis, safety, urgency, legal, tariff or cost promise.
No mail/call preparation, sending, external completion or tracking. Official
identity/photo/privacy/retention/country/forwarding/guest/receipt remain unqualified.
Historical1995–1996/2012 dates differ from metadata/upload; no legal-validity or
current-tariff guarantee. EnBAG affiliation does not establish shared fault intake.

Six raw pins cover own robots, home, undated executive, staff, EVS operator page
and actual opaque electricity PDF. The shared verifier is unchanged: strict PDF
MIME/signature/exact bytes under1MB, fatal UTF8 HTML/robots, ten-second shared
spacing/fifty-second cold reads and permanent refusal before cached peers. No PDF
parsing/execution, merger deadline or later-tariff inference. Source bodies stay
private. Never automatically retry, recreate or change channel after uncertainty;
no office, EVS staff, member, substitute, phone, contractor, EnBAG or provider fallback.
Local tests and integration are separate from approved public release, canonical
consumer delivery and verified sending. Global send switches still refuse.
