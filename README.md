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
