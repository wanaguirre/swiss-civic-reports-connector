import {
  rivazWaterUrl,
  rivazMunicipalityUrl,
  rivazPrivacyUrl,
  rivazScope,
  rivazCategories,
  rivazRequirements,
  assertRivazSourcesAvailable,
  loadRivazCategories,
} from './rivaz-form.js';
import {
  sieReportUrl,
  sieFaqUrl,
  sieMandateUrl,
  siePrivacyUrl,
  sieScopeFor,
  sieMunicipalities,
  isSieMunicipality,
  sieCategories,
  sieRequirements,
  assertSieSourcesAvailable,
  loadSieCategories,
} from './sie-form.js';
import {
  grandsonWorksUrl,
  grandsonMunicipalityUrl,
  grandsonContactUrl,
  grandsonScope,
  grandsonCategories,
  grandsonRequirements,
  assertGrandsonSourcesAvailable,
  loadGrandsonCategories,
} from './grandson-form.js';
import {
  essertinesFormUrl,
  essertinesMunicipalityUrl,
  essertinesScope,
  essertinesCategories,
  essertinesRequirements,
  assertEssertinesSourcesAvailable,
  loadEssertinesCategories,
} from './essertines-form.js';
import {
  ewrFormUrl,
  ewrPrivacyUrl,
  ewrMunicipalities,
  isEwrMunicipality,
  ewrScope,
  ewrCategories,
  ewrRequirements,
  assertEwrSourcesAvailable,
  loadEwrCategories,
} from './ewr-form.js';
import {
  reaFormUrl,
  reaPrivacyUrl,
  reaMunicipalities,
  isReaMunicipality,
  reaScope,
  reaCategories,
  reaRequirements,
  assertReaSourcesAvailable,
  loadReaCategories,
} from './rea-form.js';
import {
  zofingenFormUrl,
  zofingenPrivacyUrl,
  zofingenReferralUrl,
  zofingenScope,
  zofingenCategories,
  zofingenRequirements,
  loadZofingenCategories,
  assertZofingenSourcesAvailable,
} from './zofingen-form.js';
import {
  tbwFormUrl,
  tbwPrivacyUrl,
  tbwReferralUrl,
  tbwScope,
  tbwCategories,
  tbwRequirements,
  loadTbwCategories,
  assertTbwSourcesAvailable,
} from './tbw-form.js';
import {
  diessenhofenFormUrl,
  diessenhofenPrivacyUrl,
  diessenhofenReferralUrl,
  diessenhofenScope,
  diessenhofenCategories,
  diessenhofenRequirements,
  loadDiessenhofenCategories,
  assertDiessenhofenSourcesAvailable,
} from './diessenhofen-form.js';
import {
  obermumpfFormUrl,
  obermumpfPrivacyUrl,
  obermumpfReferralUrl,
  obermumpfScope,
  obermumpfCategories,
  obermumpfRequirements,
  loadObermumpfCategories,
  assertObermumpfSourcesAvailable,
} from './obermumpf-form.js';
import {
  auwFormUrl,
  auwPrivacyUrl,
  auwReferralUrl,
  auwScope,
  auwCategories,
  auwRequirements,
  loadAuwCategories,
  assertAuwSourcesAvailable,
} from './auw-form.js';
import {
  swlLightingFormUrl,
  swlLightingPrivacyUrl,
  swlReferralUrl,
  swlElectricityUrl,
  swlScope,
  swlCategories,
  swlRequirements,
  loadSwlCategories,
  assertSwlSourcesAvailable,
} from './swl-form.js';
import {
  tbseonFormUrl,
  tbseonPrivacyUrl,
  tbseonReferralUrl,
  tbseonScope,
  tbseonCategories,
  tbseonRequirements,
  loadTbseonCategories,
  assertTbseonSourcesAvailable,
} from './tbseon-form.js';
import {
  rwbWindischIdentityUrl,
  rwbWindischReferralUrl,
  assertRwbWindischSourcesAvailable,
  loadRwbWindischCategories,
  rwbWindischRequirements,
} from './rwb-windisch-form.js';
import {
  egmFormUrl,
  egmIdentityUrl,
  egmPrivacyUrl,
  egmScope,
  egmCategories,
  egmRequirements,
  loadEgmCategories,
} from './egm-form.js';
import { assertEgmSourcesAvailable } from './egm-source.js';
import {
  ibwFormUrl,
  ibwPrivacyUrl,
  ibwIdentityUrl,
  ibwScope,
  ibwCategories,
  ibwRequirements,
  loadIbwCategories,
} from './ibw-form.js';
import { assertIbwSourcesAvailable } from './ibw-source.js';
import {
  ewwFormUrl,
  ewwPrivacyUrl,
  ewwIdentityUrl,
  ewwScope,
  ewwCategories,
  ewwRequirements,
  loadEwwCategories,
} from './eww-form.js';
import { assertEwwSourcesAvailable } from './eww-source.js';
import {
  egsFormUrl,
  egsPrivacyUrl,
  egsMunicipalities,
  egsCategories,
  isEgsMunicipality,
  egsScope,
  egsRequirements,
  loadEgsCategories,
  assertEgsSourcesAvailable,
} from './egs-form.js';
import {
  ewnFormUrl,
  ewnPrivacyUrl,
  ewnReferralUrl,
  ewnScope,
  ewnRequirements,
  loadEwnCategories,
} from './ewn-form.js';
import {
  rwbFormUrl,
  rwbPrivacyUrl,
  rwbInvitationUrl,
  rwbReferralUrl,
  rwbScope,
  rwbRequirements,
  rwbCategories,
  loadRwbCategories,
} from './rwb-form.js';
import {
  tbsFormUrl,
  tbsPrivacyUrl,
  tbsReferralUrl,
  tbsScope,
  tbsRequirements,
  inspectTbsForm,
  loadTbsCategories,
} from './tbs-form.js';
import {
  tbgraenichenFormUrl,
  tbgraenichenPrivacyUrl,
  tbgraenichenScope,
  tbgraenichenRequirements,
  inspectTbgraenichenForm,
  loadTbgraenichenCategories,
} from './tbgraenichen-form.js';
import {
  hornetFormUrl,
  hornetTermsUrl,
  hornetAarauReferralUrl,
  hornetAarauScope,
  hornetRequirements,
  loadHornetCategories,
} from './hornet-form.js';
import {
  rabiosaFormUrl,
  rabiosaMandateUrl,
  rabiosaScope,
  rabiosaRequirements,
  inspectRabiosaForm,
} from './rabiosa-form.js';
import {
  energiaEngiadinaFormUrl,
  energiaEngiadinaMandateUrl,
  energiaEngiadinaScope,
  energiaEngiadinaRequirements,
  inspectEnergiaEngiadinaForm,
} from './energia-engiadina-form.js';
import {
  inspectThusisForm,
  thusisFormUrl,
  thusisNoticeUrl,
  thusisScope,
  thusisRequirements,
} from './thusis-form.js';
import {
  inspectFaleraForm,
  faleraFormUrl,
  faleraWorksUrl,
  faleraScope,
  faleraRequirements,
} from './falera-form.js';
import {
  wilLightingFormUrl,
  wilLightingScope,
  wilLightingRequirements,
  inspectWilLightingForm,
} from './wil-lighting-form.js';
import {
  ewsennwaldFormUrl,
  ewsennwaldMandateUrl,
  ewsennwaldScope,
  ewsennwaldRequirements,
  inspectEwsennwaldForm,
  isEwsennwaldMunicipality,
} from './ewsennwald-form.js';
import {
  ewbuchsFormUrl,
  ewbuchsOrganisationUrl,
  ewbuchsPrivacyUrl,
  ewbuchsScope,
  ewbuchsRequirements,
  inspectEwbuchsForm,
} from './ewbuchs-form.js';
import {
  stmargrethenFormUrl,
  stmargrethenReferralUrl,
  stmargrethenScope,
  stmargrethenRequirements,
  inspectStmargrethenForm,
} from './stmargrethen-form.js';
import {
  waldstattFormUrl,
  waldstattReferralUrl,
  waldstattMandateUrl,
  waldstattScope,
  waldstattRequirements,
  inspectWaldstattForm,
} from './waldstatt-form.js';
import {
  tittertenFormUrl,
  tittertenReferralUrl,
  tittertenScope,
  tittertenRequirements,
  inspectTittertenForm,
} from './titterten-form.js';
import {
  wintersingenFormUrl,
  wintersingenReferralUrl,
  wintersingenScope,
  wintersingenRequirements,
  inspectWintersingenForm,
} from './wintersingen-form.js';
import {
  therwilFormUrl,
  therwilReferralUrl,
  therwilScope,
  therwilRequirements,
  inspectTherwilForm,
} from './therwil-form.js';
import {
  reinachBlFormUrl,
  reinachBlScope,
  reinachBlRequirements,
  inspectReinachBlForm,
} from './reinach-bl-form.js';
import {
  valDeCharmeyFormUrl,
  valDeCharmeyScope,
  valDeCharmeyRequirements,
  inspectValDeCharmeyForm,
} from './val-de-charmey-form.js';
import {
  wuennewilFormUrl,
  wuennewilScope,
  wuennewilRequirements,
  inspectWuennewilForm,
} from './wuennewil-form.js';
import {
  lungernFormUrl,
  lungernReferralUrl,
  lungernPrivacyUrl,
  lungernWidgetUrl,
  lungernScope,
  lungernRequirements,
  loadLungernCategories,
} from './lungern-form.js';
import {
  ebsFormUrl,
  ebsMandateUrl,
  ebsMunicipalities,
  isEbsMunicipality,
  ebsScope,
  ebsRequirements,
  inspectEbsForm,
} from './ebs-form.js';
import {
  erstfeldFormUrl,
  erstfeldMandateUrl,
  erstfeldScope,
  erstfeldRequirements,
  inspectErstfeldForm,
} from './erstfeld-form.js';
import {
  ckwFormUrl,
  ckwComponentUrl,
  inspectCkwForm,
  ckwMunicipalities,
  isCkwMunicipality,
  ckwRequirements,
  ckwScope,
} from './ckw-form.js';
import {
  buchsiFormUrl,
  buchsiScope,
  buchsiRequirements,
  inspectBuchsiForm,
} from './buchsi-form.js';
import {
  dotzigenFormUrl,
  dotzigenScope,
  dotzigenRequirements,
  inspectDotzigenForm,
} from './dotzigen-form.js';
import { evbFormUrl, evbScope, evbRequirements, inspectEvbForm } from './evb-form.js';
import {
  ostermundigenForms,
  ostermundigenScope,
  ostermundigenRequirements,
  inspectOstermundigenForm,
} from './ostermundigen-form.js';
import {
  inspectWohlenBeForm,
  wohlenBeRequirements,
  wohlenBeScope,
  wohlenBeFormUrl,
  wohlenBeTermsUrl,
} from './wohlen-be-form.js';
import {
  inspectRoggwilForm,
  roggwilRequirements,
  roggwilScope,
  roggwilFormUrl,
} from './roggwil-form.js';
import {
  inspectLangenthalForm,
  langenthalRequirements,
  langenthalScope,
  langenthalFormUrl,
} from './langenthal-form.js';
import {
  loadStaefaCategories,
  staefaRequirements,
  staefaScope,
  staefaFormUrl,
} from './staefa-form.js';
import { inspectWazForm, wazRequirements, wazScope, wazFormUrl } from './waz-form.js';
import {
  inspectMarthalenForm,
  marthalenRequirements,
  marthalenScope,
  marthalenTermsUrl,
} from './marthalen-form.js';
import { inspectBoenigenForm, boenigenRequirements, boenigenScope } from './boenigen-form.js';
import { inspectGossauForm, gossauRequirements, gossauScope } from './gossau-form.js';
import { inspectMeggenForm, submitOneGov, oneGovReportUrl } from './onegov-form.js';
import { inspectEbikonForm } from './ebikon-form.js';
import {
  inspectNetzulgForm,
  netzulgFormUrl,
  netzulgRequirements,
  netzulgScope,
} from './netzulg-form.js';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { CityClient } from './city.js';
import {
  coordinates,
  reportInput,
  type Point,
  type Prepared,
  type ReportInput,
  type Requirements,
} from './model.js';
import type { ReportingAdapter, ReportingGuidance } from './municipalities.js';
import { SwissPlaces } from './places.js';

export const municipalForms = Object.freeze({
  'ewr-romanshorn': Object.freeze({
    ...ewrMunicipalities['ewr-romanshorn'],
    language: 'de' as const,
    formUrl: ewrFormUrl,
    reportingUrl: ewrFormUrl,
  }),
  'ewr-salmsach': Object.freeze({
    ...ewrMunicipalities['ewr-salmsach'],
    language: 'de' as const,
    formUrl: ewrFormUrl,
    reportingUrl: ewrFormUrl,
  }),
  'ewr-uttwil': Object.freeze({
    ...ewrMunicipalities['ewr-uttwil'],
    language: 'de' as const,
    formUrl: ewrFormUrl,
    reportingUrl: ewrFormUrl,
  }),
  'rea-hefenhofen': Object.freeze({
    ...reaMunicipalities['rea-hefenhofen'],
    language: 'de' as const,
    formUrl: reaFormUrl,
    reportingUrl: reaFormUrl,
  }),
  'rea-amriswil': Object.freeze({
    ...reaMunicipalities['rea-amriswil'],
    language: 'de' as const,
    formUrl: reaFormUrl,
    reportingUrl: reaFormUrl,
  }),
  'zofingen-infrastructure': Object.freeze({
    bfsId: 4289,
    municipality: 'Zofingen',
    language: 'de' as const,
    formUrl: zofingenFormUrl,
    reportingUrl: zofingenFormUrl,
  }),
  'tbw-weinfelden': Object.freeze({
    bfsId: 4946,
    municipality: 'Weinfelden',
    language: 'de' as const,
    formUrl: tbwFormUrl,
    reportingUrl: tbwFormUrl,
  }),
  'diessenhofen-stadtmelder': Object.freeze({
    bfsId: 4545,
    municipality: 'Diessenhofen',
    language: 'de' as const,
    formUrl: diessenhofenFormUrl,
    reportingUrl: diessenhofenFormUrl,
  }),
  'obermumpf-lighting': Object.freeze({
    bfsId: 4256,
    municipality: 'Obermumpf',
    language: 'de' as const,
    formUrl: obermumpfFormUrl,
    reportingUrl: obermumpfFormUrl,
  }),
  'egm-muelligen': Object.freeze({
    bfsId: 4107,
    municipality: 'Mülligen',
    language: 'de' as const,
    formUrl: egmFormUrl,
    reportingUrl: egmFormUrl,
  }),
  'swl-staufen': Object.freeze({
    bfsId: 4210,
    municipality: 'Staufen',
    language: 'de' as const,
    formUrl: swlLightingFormUrl,
    reportingUrl: swlLightingFormUrl,
  }),
  'elektra-auw': Object.freeze({
    bfsId: 4223,
    municipality: 'Auw',
    language: 'de' as const,
    formUrl: auwFormUrl,
    reportingUrl: auwFormUrl,
  }),
  'tbseon-egliswil': Object.freeze({
    bfsId: 4195,
    municipality: 'Egliswil',
    language: 'de' as const,
    formUrl: tbseonFormUrl,
    reportingUrl: tbseonFormUrl,
  }),
  'ibw-wohlen-ag': Object.freeze({
    bfsId: 4082,
    municipality: 'Wohlen (AG)',
    language: 'de' as const,
    formUrl: ibwFormUrl,
    reportingUrl: ibwFormUrl,
  }),
  'eww-wettingen': Object.freeze({
    bfsId: 4045,
    municipality: 'Wettingen',
    language: 'de' as const,
    formUrl: ewwFormUrl,
    reportingUrl: ewwFormUrl,
  }),
  'egs-obersiggenthal': Object.freeze({
    ...egsMunicipalities['egs-obersiggenthal'],
    language: 'de' as const,
    formUrl: egsFormUrl,
    reportingUrl: egsFormUrl,
  }),
  'egs-untersiggenthal': Object.freeze({
    ...egsMunicipalities['egs-untersiggenthal'],
    language: 'de' as const,
    formUrl: egsFormUrl,
    reportingUrl: egsFormUrl,
  }),
  'ewn-neuenhof': Object.freeze({
    bfsId: 4034,
    municipality: 'Neuenhof',
    language: 'de' as const,
    formUrl: ewnFormUrl,
    reportingUrl: ewnFormUrl,
  }),
  'rwb-windisch': Object.freeze({
    bfsId: 4123,
    municipality: 'Windisch',
    language: 'de' as const,
    formUrl: rwbFormUrl,
    reportingUrl: rwbFormUrl,
  }),
  'rwb-ennetbaden': Object.freeze({
    bfsId: 4026,
    municipality: 'Ennetbaden',
    language: 'de' as const,
    formUrl: rwbFormUrl,
    reportingUrl: rwbFormUrl,
  }),
  'tbs-suhr': Object.freeze({
    bfsId: 4012,
    municipality: 'Suhr',
    language: 'de' as const,
    formUrl: tbsFormUrl,
    reportingUrl: tbsFormUrl,
  }),
  tbgraenichen: Object.freeze({
    bfsId: 4006,
    municipality: 'Gränichen',
    language: 'de' as const,
    formUrl: tbgraenichenFormUrl,
    reportingUrl: tbgraenichenFormUrl,
  }),
  'hornet-aarau': Object.freeze({
    bfsId: 4001,
    municipality: 'Aarau',
    language: 'de' as const,
    formUrl: hornetFormUrl,
    reportingUrl: hornetFormUrl,
  }),
  'rabiosa-churwalden': Object.freeze({
    bfsId: 3911,
    municipality: 'Churwalden',
    language: 'de' as const,
    formUrl: rabiosaFormUrl,
    reportingUrl: rabiosaFormUrl,
  }),
  'ee-engiadina-scuol': Object.freeze({
    bfsId: 3762,
    municipality: 'Scuol',
    language: 'de' as const,
    formUrl: energiaEngiadinaFormUrl,
    reportingUrl: energiaEngiadinaFormUrl,
  }),
  thusis: Object.freeze({
    bfsId: 3668,
    municipality: 'Thusis',
    language: 'de' as const,
    formUrl: thusisFormUrl,
    reportingUrl: thusisFormUrl,
  }),
  falera: Object.freeze({
    bfsId: 3572,
    municipality: 'Falera',
    language: 'de' as const,
    formUrl: faleraFormUrl,
    reportingUrl: faleraFormUrl,
  }),
  'wil-lighting': Object.freeze({
    bfsId: 3427,
    municipality: 'Wil (SG)',
    language: 'de' as const,
    formUrl: wilLightingFormUrl,
    reportingUrl: wilLightingFormUrl,
  }),
  'ewsennwald-sennwald': Object.freeze({
    bfsId: 3274,
    municipality: 'Sennwald',
    language: 'de' as const,
    formUrl: ewsennwaldFormUrl,
    reportingUrl: ewsennwaldFormUrl,
  }),
  'ewsennwald-altstaetten': Object.freeze({
    bfsId: 3251,
    municipality: 'Altstätten',
    language: 'de' as const,
    formUrl: ewsennwaldFormUrl,
    reportingUrl: ewsennwaldFormUrl,
  }),
  ewbuchs: Object.freeze({
    bfsId: 3271,
    municipality: 'Buchs (SG)',
    language: 'de' as const,
    formUrl: ewbuchsFormUrl,
    reportingUrl: ewbuchsFormUrl,
  }),
  stmargrethen: Object.freeze({
    bfsId: 3236,
    municipality: 'St. Margrethen',
    language: 'de' as const,
    formUrl: stmargrethenFormUrl,
    reportingUrl: stmargrethenFormUrl,
  }),
  waldstatt: Object.freeze({
    bfsId: 3007,
    municipality: 'Waldstatt',
    language: 'de' as const,
    formUrl: waldstattFormUrl,
    reportingUrl: waldstattFormUrl,
  }),
  titterten: Object.freeze({
    bfsId: 2894,
    municipality: 'Titterten',
    language: 'de' as const,
    formUrl: tittertenFormUrl,
    reportingUrl: tittertenFormUrl,
  }),
  wintersingen: Object.freeze({
    bfsId: 2866,
    municipality: 'Wintersingen',
    language: 'de' as const,
    formUrl: wintersingenFormUrl,
    reportingUrl: wintersingenFormUrl,
  }),
  therwil: Object.freeze({
    bfsId: 2775,
    municipality: 'Therwil',
    language: 'de' as const,
    formUrl: therwilFormUrl,
    reportingUrl: therwilFormUrl,
  }),
  'reinach-bl': Object.freeze({
    bfsId: 2773,
    municipality: 'Reinach (BL)',
    language: 'de' as const,
    formUrl: reinachBlFormUrl,
    reportingUrl: reinachBlFormUrl,
  }),
  'val-de-charmey': Object.freeze({
    bfsId: 2163,
    municipality: 'Val-de-Charmey',
    language: 'fr' as const,
    formUrl: valDeCharmeyFormUrl,
    reportingUrl: valDeCharmeyFormUrl,
  }),
  'wuennewil-flamatt': Object.freeze({
    bfsId: 2309,
    municipality: 'Wünnewil-Flamatt',
    language: 'de' as const,
    formUrl: wuennewilFormUrl,
    reportingUrl: wuennewilFormUrl,
  }),
  lungern: Object.freeze({
    bfsId: 1405,
    municipality: 'Lungern',
    language: 'de' as const,
    formUrl: lungernFormUrl,
    reportingUrl: lungernFormUrl,
  }),
  sattel: Object.freeze({
    bfsId: 1371,
    municipality: 'Sattel',
    language: 'de' as const,
    formUrl: ebsFormUrl,
    reportingUrl: ebsFormUrl,
  }),
  schwyz: Object.freeze({
    bfsId: 1372,
    municipality: 'Schwyz',
    language: 'de' as const,
    formUrl: ebsFormUrl,
    reportingUrl: ebsFormUrl,
  }),
  erstfeld: Object.freeze({
    bfsId: 1206,
    municipality: 'Erstfeld',
    language: 'de' as const,
    formUrl: erstfeldFormUrl,
    reportingUrl: erstfeldFormUrl,
  }),
  wauwil: Object.freeze({
    bfsId: 1146,
    municipality: 'Wauwil',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  wikon: Object.freeze({
    bfsId: 1147,
    municipality: 'Wikon',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  schoetz: Object.freeze({
    bfsId: 1143,
    municipality: 'Schötz',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  ettiswil: Object.freeze({
    bfsId: 1128,
    municipality: 'Ettiswil',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  dagmersellen: Object.freeze({
    bfsId: 1125,
    municipality: 'Dagmersellen',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  sursee: Object.freeze({
    bfsId: 1103,
    municipality: 'Sursee',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  schenkon: Object.freeze({
    bfsId: 1099,
    municipality: 'Schenkon',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  ruswil: Object.freeze({
    bfsId: 1098,
    municipality: 'Ruswil',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  oberkirch: Object.freeze({
    bfsId: 1095,
    municipality: 'Oberkirch',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  knutwil: Object.freeze({
    bfsId: 1089,
    municipality: 'Knutwil',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  eich: Object.freeze({
    bfsId: 1084,
    municipality: 'Eich',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  bueron: Object.freeze({
    bfsId: 1082,
    municipality: 'Büron',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  adligenswil: Object.freeze({
    bfsId: 1051,
    municipality: 'Adligenswil',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  werthenstein: Object.freeze({
    bfsId: 1009,
    municipality: 'Werthenstein',
    language: 'de' as const,
    formUrl: ckwFormUrl,
    reportingUrl: ckwFormUrl,
  }),
  oberhofen: Object.freeze({
    bfsId: 934,
    municipality: 'Oberhofen am Thunersee',
    language: 'de' as const,
    formUrl: netzulgFormUrl,
    reportingUrl: netzulgFormUrl,
  }),
  steffisburg: Object.freeze({
    bfsId: 939,
    municipality: 'Steffisburg',
    language: 'de' as const,
    formUrl: netzulgFormUrl,
    reportingUrl: netzulgFormUrl,
  }),
  buchsi: Object.freeze({
    bfsId: 546,
    municipality: 'Münchenbuchsee',
    language: 'de',
    formUrl: buchsiFormUrl,
    reportingUrl: 'https://www.energiebuchsi.ch/de/online-schalter/',
  }),
  dotzigen: Object.freeze({
    bfsId: 386,
    municipality: 'Dotzigen',
    language: 'de',
    formUrl: dotzigenFormUrl,
    reportingUrl: dotzigenFormUrl,
  }),
  bueren: Object.freeze({
    bfsId: 383,
    municipality: 'Büren an der Aare',
    language: 'de',
    formUrl: evbFormUrl,
    reportingUrl: evbFormUrl,
  }),
  ostermundigen: Object.freeze({
    bfsId: 363,
    municipality: 'Ostermundigen',
    language: 'de',
    formUrl: ostermundigenForms.lighting.url,
    reportingUrl: 'https://www.ostermundigen.ch/de/verwaltung/abteilungen/detail/detail.php?i=16',
  }),
  'wohlen-be': Object.freeze({
    bfsId: 360,
    municipality: 'Wohlen bei Bern',
    language: 'de' as const,
    formUrl: wohlenBeFormUrl,
    reportingUrl: wohlenBeFormUrl,
  }),
  roggwil: Object.freeze({
    bfsId: 337,
    municipality: 'Roggwil (BE)',
    language: 'de' as const,
    formUrl: roggwilFormUrl,
    reportingUrl: roggwilFormUrl,
  }),
  langenthal: Object.freeze({
    bfsId: 329,
    municipality: 'Langenthal',
    language: 'de' as const,
    formUrl: langenthalFormUrl,
    reportingUrl: langenthalFormUrl,
  }),
  staefa: Object.freeze({
    bfsId: 158,
    municipality: 'Stäfa',
    language: 'de' as const,
    formUrl: staefaFormUrl,
    reportingUrl: staefaFormUrl,
  }),
  erlenbach: Object.freeze({
    bfsId: 151,
    municipality: 'Erlenbach (ZH)',
    language: 'de' as const,
    formUrl: wazFormUrl,
    reportingUrl: wazFormUrl,
  }),
  zollikon: Object.freeze({
    bfsId: 161,
    municipality: 'Zollikon',
    language: 'de' as const,
    formUrl: wazFormUrl,
    reportingUrl: wazFormUrl,
  }),
  marthalen: Object.freeze({
    bfsId: 35,
    municipality: 'Marthalen',
    language: 'de' as const,
    formUrl: 'https://eg-m.ch/online-schalter/',
    reportingUrl: 'https://eg-m.ch/online-schalter/',
  }),
  'sie-crissier': Object.freeze({
    ...sieMunicipalities['sie-crissier'],
    language: 'fr' as const,
    formUrl: sieReportUrl,
    reportingUrl: sieReportUrl,
  }),
  'sie-renens': Object.freeze({
    ...sieMunicipalities['sie-renens'],
    language: 'fr' as const,
    formUrl: sieReportUrl,
    reportingUrl: sieReportUrl,
  }),
  'sie-chavannes': Object.freeze({
    ...sieMunicipalities['sie-chavannes'],
    language: 'fr' as const,
    formUrl: sieReportUrl,
    reportingUrl: sieReportUrl,
  }),
  'sie-ecublens': Object.freeze({
    ...sieMunicipalities['sie-ecublens'],
    language: 'fr' as const,
    formUrl: sieReportUrl,
    reportingUrl: sieReportUrl,
  }),
  'rivaz-water': Object.freeze({
    bfsId: 5609,
    municipality: 'Rivaz',
    language: 'fr' as const,
    formUrl: rivazWaterUrl,
    reportingUrl: rivazWaterUrl,
  }),
  'grandson-voirie': Object.freeze({
    bfsId: 5561,
    municipality: 'Grandson',
    language: 'fr' as const,
    formUrl: grandsonWorksUrl,
    reportingUrl: grandsonWorksUrl,
  }),
  'essertines-voirie': Object.freeze({
    bfsId: 5520,
    municipality: 'Essertines-sur-Yverdon',
    language: 'fr' as const,
    formUrl: essertinesFormUrl,
    reportingUrl: essertinesFormUrl,
  }),
  boenigen: Object.freeze({
    bfsId: 572,
    municipality: 'Bönigen',
    language: 'de' as const,
    formUrl: 'https://boenigen.ch/services/schaden-melden/',
    reportingUrl: 'https://boenigen.ch/services/schaden-melden/',
  }),
  gossau: Object.freeze({
    bfsId: 115,
    municipality: 'Gossau ZH',
    language: 'de' as const,
    formUrl: 'https://www.gossau-zh.ch/problem-melden/',
    reportingUrl: 'https://www.gossau-zh.ch/problem-melden/',
  }),
  meggen: Object.freeze({
    bfsId: 1063,
    municipality: 'Meggen',
    language: 'de' as const,
    formUrl: 'https://www.meggen.ch/form/meldung-sicherheitsproblem',
    reportingUrl: 'https://www.meggen.ch/form/meldung-sicherheitsproblem',
  }),
  ebikon: Object.freeze({
    bfsId: 1054,
    municipality: 'Ebikon',
    language: 'de' as const,
    formUrl: 'https://www.ebikon.ch/form/schaden-melden',
    reportingUrl: 'https://www.ebikon.ch/form/schaden-melden',
  }),
  bern: Object.freeze({
    bfsId: 351,
    municipality: 'Bern',
    language: 'de' as const,
    formUrl: 'https://www.bern.ch/helfen/@@damagereport',
    reportingUrl: 'https://www.bern.ch/helfen/block_view',
  }),
  fribourg: Object.freeze({
    bfsId: 2196,
    municipality: 'Fribourg',
    language: 'fr' as const,
    formUrl: 'https://www.ville-fribourg.ch/on-repare',
    reportingUrl: 'https://www.ville-fribourg.ch/on-repare',
  }),
});
type Name = keyof typeof municipalForms;
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Category = { service_code: string; service_name: string };
const attr = (node: Element, key: string) => node.attrs.find((a) => a.name === key)?.value;
const all = (node: Node): Element[] => [
  ...('tagName' in node ? [node] : []),
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
const text = (node: Node): string =>
  'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
const hasClass = (node: Element, value: string) =>
  (attr(node, 'class') ?? '').split(/\s+/).includes(value);
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const changed = () =>
  new Error('The municipal reporting form is unavailable or has changed. Preparation is paused.');
const fribourgClass = 'webform-submission-gcee-avis-de-defectuosite-form';
const fribourgId = 'webform_submission_gcee_avis_de_defectuosite_paragraph_11662_add_form';
const specs = {
  bern: [
    ['form.widgets.image', 'file', false],
    ['form.widgets.location', 'text', true],
    ['form.widgets.category:list', 'select', true],
    ['form.widgets.category-empty-marker', 'hidden', false],
    ['form.widgets.email', 'text', true],
    ['form.widgets.message', 'textarea', false],
    ['accept_terms', 'checkbox', false],
    ['accept_text', 'text', false],
    ['form.buttons.damagereport_button_send', 'submit', false],
  ],
  fribourg: [
    ['coordonnees[name]', 'text', true],
    ['coordonnees[email]', 'email', true],
    ['coordonnees[phone]', 'tel', false],
    ['coordonnees[address]', 'text', true],
    ['coordonnees[address_2]', 'text', false],
    ['coordonnees[city]', 'text', true],
    ['adresse_exact', 'textarea', true],
    ['description_du_degat', 'textarea', true],
    ['files[photo_du_degat_optionnel_]', 'file', false],
    ['photo_du_degat_optionnel__upload_button', 'submit', false],
    ['photo_du_degat_optionnel_[fids]', 'hidden', false],
    ['form_build_id', 'hidden', false],
    ['form_id', 'hidden', false],
    ['op', 'submit', false],
  ],
} as const;

/** Return only public metadata. Never retain HTML, session tokens or cookies. */
export function inspectMunicipalForm(name: Name, html: string): Category[] {
  if (name === 'zofingen-infrastructure')
    throw new Error('Use the complete pinned Zofingen source contract.');
  if (name === 'swl-staufen') throw new Error('Use the complete pinned SWL source contract.');
  if (name === 'tbw-weinfelden') throw new Error('Use the complete pinned TBW source contract.');
  if (name === 'diessenhofen-stadtmelder')
    throw new Error('Use the complete pinned Diessenhofen source contract.');
  if (name === 'obermumpf-lighting')
    throw new Error('Use the complete pinned Obermumpf source contract.');
  if (name === 'elektra-auw')
    throw new Error('Use the complete pinned Elektra Auw source manifest.');
  if (name === 'tbseon-egliswil')
    throw new Error('Use the complete pinned TB Seon source manifest.');
  if (name === 'egm-muelligen') throw new Error('Use the complete checked EGM source manifest.');
  if (name === 'ibw-wohlen-ag') throw new Error('Use the complete checked ibw source manifest.');
  if (name === 'eww-wettingen')
    throw new Error('Use the complete checked Wettingen source manifest.');
  if (isEwrMunicipality(name)) throw new Error('Use the complete pinned EWR source manifest.');
  if (isReaMunicipality(name)) throw new Error('Use the complete pinned REA source manifest.');
  if (isEgsMunicipality(name)) throw new Error('Use the complete pinned EGS source manifest.');
  if (name === 'ewn-neuenhof') throw new Error('Use the complete pinned EWN source manifest.');
  if (name === 'rwb-ennetbaden' || name === 'rwb-windisch')
    throw new Error('Use the complete pinned RWB source manifest.');
  if (name === 'hornet-aarau') throw new Error('Use the complete pinned hornet source manifest.');
  if (name === 'tbs-suhr') return inspectTbsForm(html);
  if (name === 'tbgraenichen') return inspectTbgraenichenForm(html);
  if (name === 'rabiosa-churwalden') return inspectRabiosaForm(html);
  if (name === 'ee-engiadina-scuol') return inspectEnergiaEngiadinaForm(html);
  if (name === 'thusis') return inspectThusisForm(html);
  if (name === 'falera') return inspectFaleraForm(html);
  if (name === 'wil-lighting') return inspectWilLightingForm(html);
  if (isEwsennwaldMunicipality(name)) return inspectEwsennwaldForm(html);
  if (name === 'ewbuchs') return inspectEwbuchsForm(html);
  if (name === 'stmargrethen') return inspectStmargrethenForm(html);
  if (name === 'waldstatt') return inspectWaldstattForm(html);
  if (name === 'titterten') return inspectTittertenForm(html);
  if (name === 'wintersingen') return inspectWintersingenForm(html);
  if (name === 'therwil') return inspectTherwilForm(html);
  if (name === 'reinach-bl') return inspectReinachBlForm(html);
  if (name === 'lungern')
    throw new Error('The Lungern portal requires its complete tenant configuration.');
  if (isEbsMunicipality(name)) return inspectEbsForm(html);
  if (name === 'val-de-charmey') return inspectValDeCharmeyForm(html);
  if (name === 'wuennewil-flamatt') return inspectWuennewilForm(html);
  if (name === 'erstfeld') return inspectErstfeldForm(html);
  if (isCkwMunicipality(name)) return inspectCkwForm(html);
  if (name === 'oberhofen' || name === 'steffisburg') return inspectNetzulgForm(html);
  if (name === 'buchsi') return inspectBuchsiForm(html);
  if (name === 'dotzigen') return inspectDotzigenForm(html);
  if (name === 'bueren') return inspectEvbForm(html);
  if (name === 'ostermundigen')
    throw new Error('Ostermundigen requires both separate form contracts.');
  if (name === 'wohlen-be') return inspectWohlenBeForm(html);
  if (name === 'roggwil') return inspectRoggwilForm(html);
  if (name === 'langenthal') return inspectLangenthalForm(html);
  if (name === 'staefa') throw new Error('Stäfa requires its public JSON schema and translations.');
  if (name === 'erlenbach' || name === 'zollikon') return inspectWazForm(html);
  if (name === 'marthalen') return inspectMarthalenForm(html);
  if (isSieMunicipality(name))
    throw new Error('SIE requires its complete pinned public source manifest.');
  if (name === 'rivaz-water')
    throw new Error('Rivaz requires its complete pinned public source manifest.');
  if (name === 'grandson-voirie')
    throw new Error('Grandson requires its complete pinned public source manifest.');
  if (name === 'essertines-voirie')
    throw new Error('Essertines requires its complete pinned source manifest.');
  if (name === 'boenigen') return inspectBoenigenForm(html);
  if (name === 'gossau') return inspectGossauForm(html);
  if (name === 'ebikon') return inspectEbikonForm(html);
  if (name === 'meggen') return inspectMeggenForm(html);
  const config = municipalForms[name];
  if (!config || Buffer.byteLength(html) > 1_000_000) throw changed();
  const doc = all(parse(html));
  const matches = doc.filter(
    (e) =>
      e.tagName === 'form' &&
      (name === 'bern' ? attr(e, 'id') === 'damagereport-form' : hasClass(e, fribourgClass)),
  );
  if (matches.length !== 1) throw changed();
  const form = matches[0],
    nodes = all(form);
  if (
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data' ||
    new URL(attr(form, 'action') ?? '', config.formUrl).href !== config.formUrl
  )
    throw changed();
  // Scope protection checks to the report, not unrelated page-feedback forms.
  if (
    nodes.some(
      (e) =>
        e.tagName === 'iframe' ||
        /captcha|turnstile|challenge/i.test(
          [attr(e, 'id'), attr(e, 'class'), attr(e, 'name'), attr(e, 'src')].join(' '),
        ),
    )
  )
    throw changed();
  const controls = nodes.filter((e) =>
    ['input', 'textarea', 'select', 'button'].includes(e.tagName),
  );
  if (controls.length !== specs[name].length) throw changed();
  for (const [field, type, required] of specs[name]) {
    const found = controls.filter((e) => attr(e, 'name') === field);
    if (found.length !== 1) throw changed();
    const e = found[0];
    const actualType = e.tagName === 'input' ? attr(e, 'type') : e.tagName;
    if (
      actualType !== type ||
      attr(e, 'disabled') !== undefined ||
      attr(e, 'readonly') !== undefined ||
      attr(e, 'form') !== undefined ||
      attr(e, 'formaction') !== undefined ||
      attr(e, 'multiple') !== undefined ||
      (attr(e, 'required') !== undefined || hasClass(e, 'required')) !== required
    )
      throw changed();
  }
  const value = (field: string) =>
    attr(
      controls.find((e) => attr(e, 'name') === field)!,
      'value',
    ) ?? '';
  if (name === 'fribourg') {
    if (
      value('form_id') !== fribourgId ||
      !/^form-[\w-]{10,200}$/.test(value('form_build_id')) ||
      value('op') !== 'Envoyer' ||
      value('photo_du_degat_optionnel_[fids]')
    )
      throw changed();
    // A smaller live contact limit invalidates our preparation contract.
    for (const [field, limit] of [
      ['coordonnees[name]', 100],
      ['coordonnees[email]', 254],
      ['coordonnees[phone]', 50],
      ['coordonnees[address]', 255],
      ['coordonnees[address_2]', 255],
      ['coordonnees[city]', 255],
    ] as const) {
      const max = attr(
        controls.find((e) => attr(e, 'name') === field)!,
        'maxlength',
      );
      if (max !== undefined && (!/^\d+$/.test(max) || Number(max) < limit)) throw changed();
    }
    return [{ service_code: 'gcee-avis-de-defectuosite', service_name: 'Avis de défectuosité' }];
  }
  if (
    value('form.widgets.category-empty-marker') !== '1' ||
    value('form.buttons.damagereport_button_send') !== 'Melden'
  )
    throw changed();
  const selector = controls.find((e) => attr(e, 'name') === 'form.widgets.category:list')!;
  const categories = all(selector)
    .filter((e) => e.tagName === 'option' && attr(e, 'value') !== 'None')
    .map((e) => {
      const code = attr(e, 'value') ?? '',
        label = normalize(text(e));
      if (
        !/^[a-z][a-z0-9-]{0,99}$/.test(code) ||
        !label ||
        label.length > 100 ||
        attr(e, 'disabled') !== undefined
      )
        throw changed();
      return { service_code: code, service_name: label };
    });
  if (
    !categories.length ||
    categories.length > 100 ||
    new Set(categories.map((c) => c.service_code)).size !== categories.length ||
    new Set(categories.map((c) => c.service_name)).size !== categories.length
  )
    throw changed();
  return categories;
}

async function readHtml(response: Response) {
  if (
    !response.ok ||
    !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
    !response.body
  ) {
    await response.body?.cancel();
    throw changed();
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1_000_000) throw changed();
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Preparation defaults for all forms. Only the source-reviewed OneGov profiles
 * have a separately opted-in experimental transport; applications keep it off. */
export class MunicipalFormClient implements ReportingAdapter {
  readonly bfsId: number;
  readonly municipality: string;
  readonly deliveryLanguage: 'de' | 'fr';
  readonly serviceId: string;
  readonly reportingService: string;
  readonly reportingUrl: string;
  readonly reportFormUrl: string;
  readonly submissionMode: 'unverified' | 'direct';
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly privacy: string;
  readonly termsUrl?: string;
  readonly guidance: ReportingGuidance;
  private places: Pick<SwissPlaces, 'municipality'>;
  private now: () => number;
  private cached?: { expires: number; value: Category[] };
  private pending?: Promise<Category[]>;
  private retryAt = 0;
  constructor(
    private name: Name,
    private request: typeof fetch = fetch,
    options: {
      places?: Pick<SwissPlaces, 'municipality'>;
      now?: () => number;
      experimentalSubmission?: boolean;
    } = {},
  ) {
    const config = municipalForms[name];
    if (!config) throw new Error('Unsupported municipal form.');
    if (options.experimentalSubmission && name !== 'ebikon' && name !== 'meggen')
      throw new Error('Experimental submission is only implemented for the reviewed OneGov forms.');
    this.submissionMode = options.experimentalSubmission === true ? 'direct' : 'unverified';
    this.privacy =
      this.submissionMode === 'direct'
        ? 'After your approval, Civic sends your reviewed contact details, report and optional normalized photo to the municipality. Its service emails a ticket reference; Civic does not request a personal-data copy by email.'
        : 'Preparation keeps contact details and normalized photos in Civic. Sending is disabled pending a genuine municipal delivery pilot.';
    if (name === 'val-de-charmey')
      this.privacy =
        'Preparation stays in Civic and accepts no reporter contact fields. The official portal is configured to publish title, details, coordinates and any attached photo publicly. Choose publication yourself after review; Civic does not send or publish anything.';
    if (name === 'hornet-aarau')
      this.privacy =
        'Preparation keeps private contact details and normalized photos in Civic. The provider policy allows competent responders to receive contacts and observation data to be shared under its rules; exact coordinate publication has conditions. Civic does not send, publish, look up contacts or execute the provider client.';
    if (name === 'tbgraenichen')
      this.privacy =
        'Preparation keeps private contacts in Civic, outside AI, and accepts no photos. The linked provider privacy page yielded no substantive sharing/retention policy body. Civic performs no provider client/protection execution, sending or external transfer.';
    if (name === 'tbs-suhr')
      this.privacy =
        'Local preparation keeps private reporter names/address/contact preference separate from the fault location and outside AI. The provider describes contact-form delivery by email and storage for inquiries; its general sharing/cross-border policy applies, with no fixed report retention established. Civic sends nothing and never executes or simulates native interaction.';
    this.bfsId = config.bfsId;
    this.municipality = config.municipality;
    this.deliveryLanguage = config.language;
    this.serviceId = `${name}-defect-form`;
    this.termsUrl =
      name === 'hornet-aarau'
        ? hornetTermsUrl
        : name === 'ewbuchs'
          ? ewbuchsPrivacyUrl
          : name === 'lungern'
            ? lungernPrivacyUrl
            : name === 'dotzigen'
              ? 'https://www.dotzigen.ch/de/datenschutz/'
              : name === 'bueren'
                ? 'https://www.ev-bueren.ch/datenschutz/'
                : name === 'ostermundigen'
                  ? 'https://www.ostermundigen.ch/de/datenschutz/nutzungsbedingungen.php'
                  : name === 'wohlen-be'
                    ? wohlenBeTermsUrl
                    : name === 'marthalen'
                      ? marthalenTermsUrl
                      : name === 'gossau'
                        ? config.formUrl
                        : undefined;
    this.reportingService =
      name === 'tbs-suhr'
        ? 'TBS Strom AG – Strassenbeleuchtung Suhr'
        : name === 'tbgraenichen'
          ? 'TB Gränichen Energie AG – Strassenbeleuchtung'
          : name === 'hornet-aarau'
            ? 'info fauna – Asiatische Hornisse (Aarau)'
            : name === 'rabiosa-churwalden'
              ? 'Rabiosa Energie – Strassenbeleuchtung Churwalden'
              : name === 'ee-engiadina-scuol'
                ? 'EE Energia Engiadina – Öffentliche Beleuchtung Scuol'
                : name === 'thusis'
                  ? 'Gemeinde Thusis – Freizeitinfrastruktur'
                  : name === 'falera'
                    ? 'Gemeinde Falera – Werkhof/Strassenwesen'
                    : name === 'wil-lighting'
                      ? 'Stadt Wil – Strassenbeleuchtung'
                      : isEwsennwaldMunicipality(name)
                        ? 'EW Sennwald – Strassenbeleuchtung'
                        : name === 'ewbuchs'
                          ? 'ewb Buchs SG – Öffentliche Beleuchtung'
                          : name === 'stmargrethen'
                            ? 'St. Margrethen – Strassenbeleuchtung'
                            : name === 'val-de-charmey'
                              ? 'Commune Val-de-Charmey – Signalement de défauts'
                              : name === 'wuennewil-flamatt'
                                ? 'Bauamt Wünnewil-Flamatt – Strassenbeleuchtung'
                                : name === 'lungern'
                                  ? 'Mängelmelder Lungern'
                                  : isEbsMunicipality(name)
                                    ? 'ebs Energie AG – Strassenbeleuchtung'
                                    : name === 'erstfeld'
                                      ? 'Gemeindewerke Erstfeld – Öffentliche Beleuchtung'
                                      : isCkwMunicipality(name)
                                        ? 'CKW – Strassenbeleuchtung'
                                        : name === 'oberhofen' || name === 'steffisburg'
                                          ? 'NetZulg – Strassenbeleuchtung'
                                          : name === 'buchsi'
                                            ? 'Energie Buchsi – Strassenbeleuchtung'
                                            : name === 'dotzigen'
                                              ? 'Gemeinde Dotzigen – Öffentliche Beleuchtung'
                                              : name === 'bueren'
                                                ? 'EVB – Strassenbeleuchtung'
                                                : name === 'ostermundigen'
                                                  ? 'Tiefbau & Betriebe – Beleuchtung und Strassenschäden'
                                                  : name === 'wohlen-be'
                                                    ? 'Gemeindebetriebe Wohlen – Strassenbeleuchtung'
                                                    : name === 'roggwil'
                                                      ? 'GBR – Strassenbeleuchtung'
                                                      : name === 'langenthal'
                                                        ? 'IB Langenthal – Strassenbeleuchtung'
                                                        : name === 'staefa'
                                                          ? 'Gemeindewerke Stäfa – Strassenbeleuchtung'
                                                          : name === 'erlenbach' ||
                                                              name === 'zollikon'
                                                            ? 'Werke am Zürichsee – Strassenbeleuchtung'
                                                            : name === 'marthalen'
                                                              ? 'EGM – Öffentliche Beleuchtung'
                                                              : name === 'gossau'
                                                                ? 'Problem melden'
                                                                : name === 'meggen'
                                                                  ? 'Meldung Sicherheitsproblem'
                                                                  : name !== 'fribourg'
                                                                    ? 'Schaden melden'
                                                                    : 'Avis de défectuosité';
    this.reportingUrl = config.reportingUrl;
    this.reportFormUrl = config.formUrl;
    this.places = options.places ?? new SwissPlaces(request);
    this.now = options.now ?? Date.now;
    this.guidance = {
      municipality: this.municipality,
      delivery_language: this.deliveryLanguage,
      verified_on:
        name === 'tbs-suhr' ||
        name === 'tbgraenichen' ||
        name === 'hornet-aarau' ||
        name === 'rabiosa-churwalden'
          ? '2026-10-19'
          : name === 'ee-engiadina-scuol' ||
              name === 'thusis' ||
              name === 'falera' ||
              name === 'wil-lighting' ||
              isEwsennwaldMunicipality(name) ||
              name === 'ewbuchs' ||
              name === 'stmargrethen' ||
              name === 'waldstatt' ||
              name === 'titterten' ||
              name === 'wintersingen'
            ? '2026-10-18'
            : name === 'therwil'
              ? '2026-10-18'
              : name === 'reinach-bl'
                ? '2026-10-18'
                : name === 'val-de-charmey' ||
                    name === 'staefa' ||
                    name === 'wuennewil-flamatt' ||
                    name === 'lungern' ||
                    isEbsMunicipality(name) ||
                    name === 'erstfeld' ||
                    isCkwMunicipality(name) ||
                    name === 'buchsi' ||
                    name === 'dotzigen' ||
                    name === 'oberhofen' ||
                    name === 'steffisburg'
                  ? '2026-10-18'
                  : name === 'bueren' ||
                      name === 'ostermundigen' ||
                      name === 'wohlen-be' ||
                      name === 'roggwil' ||
                      name === 'langenthal' ||
                      name === 'erlenbach' ||
                      name === 'zollikon' ||
                      name === 'boenigen' ||
                      name === 'marthalen'
                    ? '2026-10-17'
                    : name === 'gossau' || name === 'ebikon' || name === 'meggen'
                      ? '2026-10-16'
                      : '2026-10-15',
      sources: [
        ...(name === 'tbs-suhr'
          ? [
              { title: 'Current municipal utility referral', url: tbsReferralUrl },
              {
                title: 'Utility public fault service',
                url: 'https://www.tbsuhr.ch/support/stoerung.html/81',
              },
              { title: 'Provider privacy notice', url: tbsPrivacyUrl },
            ]
          : []),
        ...(name === 'tbgraenichen'
          ? [
              {
                title: 'Municipal utility identity and infrastructure referral',
                url: 'https://www.graenichen.ch/',
              },
              { title: 'Utility lamp form', url: tbgraenichenFormUrl },
              {
                title: 'Linked privacy page; substantive policy body unresolved',
                url: tbgraenichenPrivacyUrl,
              },
            ]
          : []),
        ...(name === 'hornet-aarau'
          ? [
              { title: 'Explicit municipal hornet sighting referral', url: hornetAarauReferralUrl },
              { title: 'Provider privacy notice', url: hornetTermsUrl },
            ]
          : []),
        ...(name === 'rabiosa-churwalden'
          ? [
              { title: 'Provider public-lighting service', url: rabiosaMandateUrl },
              {
                title: 'Municipal utility referral and infrastructure fault contacts',
                url: 'https://churwalden.ch/',
              },
            ]
          : []),
        ...(name === 'ee-engiadina-scuol'
          ? [
              { title: 'Explicit Scuol public-lighting mandate', url: energiaEngiadinaMandateUrl },
              { title: 'Current merged municipality', url: 'https://www.scuol.net/' },
            ]
          : []),
        ...(name === 'thusis'
          ? [{ title: 'Official leisure-infrastructure damage form notice', url: thusisNoticeUrl }]
          : []),
        ...(name === 'falera'
          ? [{ title: 'Municipal works questions and problems', url: faleraWorksUrl }]
          : []),
        ...(isEwsennwaldMunicipality(name)
          ? [
              {
                title: 'Explicit municipal mandate and four-village scope',
                url: ewsennwaldMandateUrl,
              },
              {
                title: 'Official municipal village membership',
                url:
                  name === 'ewsennwald-sennwald'
                    ? 'https://www.sennwald.ch/einwohnerzahl'
                    : 'https://www.altstaetten.ch/uebersichtportrait',
              },
            ]
          : []),
        ...(name === 'ewbuchs'
          ? [
              {
                title: 'Municipal EWB organisation, article2',
                url: ewbuchsOrganisationUrl,
              },
            ]
          : []),
        ...(name === 'stmargrethen'
          ? [
              {
                title: 'Official municipal streetlight form referral',
                url: stmargrethenReferralUrl,
              },
            ]
          : []),
        ...(name === 'waldstatt'
          ? [
              { title: 'Municipal Ortskorporation lighting referral', url: waldstattReferralUrl },
              {
                title: 'Operator public-lighting mandate and asset scope',
                url: waldstattMandateUrl,
              },
            ]
          : []),
        ...(name === 'titterten'
          ? [
              {
                title: 'Official municipal streetlighting service referral',
                url: tittertenReferralUrl,
              },
            ]
          : []),
        ...(name === 'wintersingen'
          ? [
              {
                title: 'Municipal second-page streetlighting form referral',
                url: wintersingenReferralUrl,
              },
            ]
          : []),
        ...(name === 'therwil'
          ? [{ title: 'Official municipal streetlighting fault referral', url: therwilReferralUrl }]
          : []),
        ...(name === 'lungern'
          ? [
              { title: 'Municipal infrastructure defect portal referral', url: lungernReferralUrl },
              { title: 'Published widget source; configuration reads only', url: lungernWidgetUrl },
            ]
          : []),
        ...(isEbsMunicipality(name)
          ? [
              {
                title: 'Municipal streetlight-fault referral to ebs',
                url: ebsMunicipalities[name].referralUrl,
              },
              { title: 'ebs public-lighting maintenance and fault mandate', url: ebsMandateUrl },
            ]
          : []),
        ...(name === 'erstfeld'
          ? [
              {
                title: 'Municipal public lighting responsibility',
                url: 'https://erstfeld.ch/infrastruktur/wasser-strom',
              },
              { title: 'GWE operation, maintenance and fault mandate', url: erstfeldMandateUrl },
            ]
          : []),
        ...(isCkwMunicipality(name)
          ? [
              {
                title: 'Municipal public-lighting referral',
                url: ckwMunicipalities[name].referralUrl,
              },
              {
                title: 'CKW public component source, reviewed without execution',
                url: ckwComponentUrl,
              },
            ]
          : []),
        ...(name === 'oberhofen' || name === 'steffisburg'
          ? [
              {
                title: 'Municipal public-lighting responsibility and NetZulg referral',
                url:
                  name === 'oberhofen'
                    ? 'https://www.oberhofen.ch/verwaltung/bauwesen/infrastruktur'
                    : 'https://www.steffisburg.ch/de/verwaltung/dienstleistungen/115_strassenbeleuchtung',
              },
            ]
          : []),
        ...(name === 'buchsi'
          ? [
              {
                title: 'Municipal energy and street-lighting referral',
                url: 'https://www.muenchenbuchsee.ch/de/verwaltung/dienstleistungen/150_energieversorgung:-stromversorgung-wasserversorgung-strassenbeleuchtung',
              },
            ]
          : []),
        ...(name === 'dotzigen'
          ? [
              {
                title: 'Werkhof lighting contact referral',
                url: 'https://www.dotzigen.ch/de/verwaltung/Werkhof/',
              },
            ]
          : []),
        ...(name === 'wohlen-be'
          ? [
              {
                title: 'Municipal and cantonal road lighting responsibilities',
                url: 'https://www.wohlen-be.ch/de/verwaltung/dienstleistungen/265_strassen',
              },
            ]
          : []),
        ...(name === 'roggwil'
          ? [
              {
                title: 'GBR municipal public-lighting mandate, annual report 2024 page 7',
                url: 'https://www.roggwil.ch/_doc/5714911',
              },
            ]
          : []),
        { title: 'Official reporting form', url: this.reportingUrl },
        ...(name === 'langenthal'
          ? [
              {
                title: 'City public-lighting responsibility and IBL referral',
                url: 'https://www.langenthal.ch/umweltenergie/49274',
              },
            ]
          : []),
        ...(name === 'staefa'
          ? [
              {
                title: 'GWS municipal public-lighting responsibility',
                url: 'https://gws.ch/stromversorgung/',
              },
            ]
          : []),
        ...(name === 'erlenbach' || name === 'zollikon'
          ? [
              {
                title: 'Municipal lighting responsibility',
                url:
                  name === 'erlenbach'
                    ? 'https://www.erlenbach.ch/de/dienstleistungen/strassenbeleuchtung/'
                    : 'https://www.zollikon.ch/verkehr',
              },
            ]
          : []),
        ...(name === 'marthalen'
          ? [
              {
                title: 'EGM municipal lighting responsibility',
                url: 'https://eg-m.ch/projekt/oeffentliche-beleuchtung/',
              },
            ]
          : []),
      ],
      scope:
        name === 'tbs-suhr'
          ? tbsScope
          : name === 'tbgraenichen'
            ? tbgraenichenScope
            : name === 'hornet-aarau'
              ? hornetAarauScope
              : name === 'rabiosa-churwalden'
                ? rabiosaScope
                : name === 'ee-engiadina-scuol'
                  ? energiaEngiadinaScope
                  : name === 'thusis'
                    ? thusisScope
                    : name === 'falera'
                      ? faleraScope
                      : name === 'wil-lighting'
                        ? wilLightingScope
                        : isEwsennwaldMunicipality(name)
                          ? ewsennwaldScope(this.bfsId)
                          : name === 'ewbuchs'
                            ? ewbuchsScope
                            : name === 'stmargrethen'
                              ? stmargrethenScope
                              : name === 'waldstatt'
                                ? waldstattScope
                                : name === 'titterten'
                                  ? tittertenScope
                                  : name === 'wintersingen'
                                    ? wintersingenScope
                                    : name === 'therwil'
                                      ? therwilScope
                                      : name === 'reinach-bl'
                                        ? reinachBlScope
                                        : name === 'val-de-charmey'
                                          ? valDeCharmeyScope
                                          : name === 'wuennewil-flamatt'
                                            ? wuennewilScope
                                            : name === 'lungern'
                                              ? lungernScope
                                              : isEbsMunicipality(name)
                                                ? ebsScope(name)
                                                : name === 'erstfeld'
                                                  ? erstfeldScope
                                                  : isCkwMunicipality(name)
                                                    ? ckwScope(name)
                                                    : name === 'oberhofen' || name === 'steffisburg'
                                                      ? netzulgScope(name)
                                                      : name === 'buchsi'
                                                        ? buchsiScope
                                                        : name === 'dotzigen'
                                                          ? dotzigenScope
                                                          : name === 'bueren'
                                                            ? evbScope
                                                            : name === 'ostermundigen'
                                                              ? ostermundigenScope
                                                              : name === 'wohlen-be'
                                                                ? wohlenBeScope
                                                                : name === 'roggwil'
                                                                  ? roggwilScope
                                                                  : name === 'langenthal'
                                                                    ? langenthalScope
                                                                    : name === 'staefa'
                                                                      ? staefaScope
                                                                      : name === 'erlenbach' ||
                                                                          name === 'zollikon'
                                                                        ? wazScope
                                                                        : name === 'marthalen'
                                                                          ? marthalenScope
                                                                          : name === 'boenigen'
                                                                            ? boenigenScope
                                                                            : name === 'gossau'
                                                                              ? gossauScope
                                                                              : name === 'meggen'
                                                                                ? 'Non-emergency safety defects in municipal infrastructure, handled by Meggen’s Planning / Construction department. Use its single safety-problem class; not general complaints or police reports.'
                                                                                : 'Non-emergency defects in municipal infrastructure and public spaces.',
      issue_groups: [],
      exclusions: [
        {
          issue: 'Emergency or immediate danger',
          next_step: 'Use the appropriate emergency service.',
        },
        ...(name === 'bern' || name === 'ebikon' || name === 'meggen'
          ? [
              {
                issue: 'Street-light fault',
                next_step:
                  name === 'meggen'
                    ? 'Meggen lists defective lighting separately from this safety-problem form.'
                    : name === 'ebikon'
                      ? 'Ebikon directs street-light faults to CKW, outside this damage form.'
                      : 'Bern directs street-light faults to Energie Wasser Bern (ewb), outside this form.',
              },
            ]
          : []),
      ],
      responsibility:
        'Use the exact municipal boundary and the official form’s current categories.',
      routing_note:
        this.submissionMode === 'direct'
          ? 'Experimental source-reviewed transport. A real municipal pilot remains pending. Only a verified ticket receipt means sent; uncertain responses must not be retried.'
          : 'Preparation only. Municipal delivery has not been pilot-verified; do not claim the report has been sent.',
    };
    if (name === 'rwb-ennetbaden' || name === 'rwb-windisch') {
      this.reportingService = `Regionalwerke AG Baden – Öffentliche Beleuchtung ${this.municipality}`;
      this.termsUrl = rwbPrivacyUrl;
      this.privacy =
        'Local preparation keeps private salutation, names and full reporter address/email/phone outside AI and separate from the lamp point. Native privacy consent is required. The provider policy describes generally Swiss storage, broad service-provider/partner/authority sharing, cross-border conditions and purpose/legal retention; no fixed lamp-report retention or publication established. Civic sends nothing and never executes reCAPTCHA or the native client.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: name === 'rwb-windisch' ? rwbWindischRequirements()['Strom'].scope! : rwbScope,
        sources: [
          {
            title: 'Municipal utility referral',
            url: name === 'rwb-windisch' ? rwbWindischReferralUrl : rwbReferralUrl,
          },
          ...(name === 'rwb-windisch'
            ? [
                {
                  title: 'EW Windisch public-lighting mandate and RWB operation',
                  url: rwbWindischIdentityUrl,
                },
              ]
            : []),
          { title: 'Explicit provider lamp-fault referral', url: rwbInvitationUrl },
          { title: 'Native public contact form', url: rwbFormUrl },
          { title: 'Provider privacy notice', url: rwbPrivacyUrl },
        ],
      };
    }
    if (name === 'ewn-neuenhof') {
      this.reportingService = 'Elektrizität Wasser Neuenhof (ewn) – Strassenbeleuchtung';
      this.privacy =
        'Local preparation keeps private salutation, names, phone/email and optional company/postal address outside AI and separate from the lamp. The provider describes purpose-limited retention up to ten years, service-provider/legal sharing and foreign-processing conditions. Its selected hCaptcha differs from the Google-reCaptcha policy entry; delivery privacy remains unresolved. Civic sends nothing and never executes the challenge or native client; no native consent checkbox is invented.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: ewnScope,
        sources: [
          { title: 'Municipal explicit utility referral', url: ewnReferralUrl },
          { title: 'Dedicated native lamp form', url: ewnFormUrl },
          {
            title: 'Provider privacy notice; challenge-vendor mismatch unresolved',
            url: ewnPrivacyUrl,
          },
        ],
      };
    }
    if (isSieMunicipality(name)) {
      this.reportingService = `SIE SA – Éclairage communal de ${sieMunicipalities[name].municipality}`;
      this.privacy =
        'Local preparation collects no reporter contacts or photos and transfers nothing. SIE asks callers to leave callback details, to add themselves in a separately chosen call. Native online requiredness/guest access and actual acceptance remain unverified. The provider asserts Swiss storage/no foreign transmission while listing processors and foreign-authority exceptions; no fixed incident retention or absolute foreign-processing guarantee. No calls, email, native payload, sending, external completion or tracking.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: sieScopeFor(name),
        responsibility: `Confirm the exact ${sieMunicipalities[name].municipality} point and actual SIE-maintained municipal lamp. Boundary and resident confirmation do not independently prove ownership. No other SIE municipality is enabled by this profile.`,
        routing_note:
          'Dedicated SIE instructions publish 021 631 51 11; FAQ instead 021 631 50 00. Discrepancy unresolved. Local note only; provider asks callback details during a separately chosen call. No contact/photo collection, calls, emails, sending or tracking. Never automatically retry, recreate or switch channels after uncertainty.',
        sources: [
          {
            title: 'Dedicated SIE lamp-fault instructions and explicit four-commune scope',
            url: sieReportUrl,
          },
          { title: 'SIE FAQ; conflicting telephone retained', url: sieFaqUrl },
          { title: 'Explicit public-lighting maintenance mandate', url: sieMandateUrl },
          {
            title: 'SIE privacy; processor and foreign-authority exceptions retained',
            url: siePrivacyUrl,
          },
        ],
      };
    }
    if (name === 'rivaz-water') {
      this.reportingService = 'Commune de Rivaz – Municipal en charge des eaux';
      this.privacy =
        'Local telephone-note preparation collects no reporter contacts or photos and makes no municipal transfer. Telephone reporter requirements and anonymous acceptance remain unverified. The water problem/emergency invitation is by telephone, but this local note excludes urgent situations, contamination, supply interruption, active leaks and flooding. The policy permits request processing and legal/service-provider sharing; retention, processing country and receipt remain unverified. No payload, sending, external completion, tracking or native/security client execution.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: rivazScope,
        responsibility:
          'Confirm a nonurgent maintenance fault of an actual communal drinking-water asset at its exact Rivaz point. Boundary and resident confirmation do not independently prove ownership; Chexbres/Puidoux sources do not expand scope.',
        routing_note:
          'Local telephone note only. No contacts or photos; no sending, external completion or tracking. Never automatically retry, recreate or switch channels after an uncertain result.',
        sources: [
          {
            title:
              'Explicit water problem/emergency telephone referral; local urgent cases excluded',
            url: rivazWaterUrl,
          },
          {
            title: 'Current municipal industrial/water responsibility',
            url: rivazMunicipalityUrl,
          },
          {
            title: 'General privacy policy; incident retention/country/receipt unknown',
            url: rivazPrivacyUrl,
          },
        ],
      };
    }
    if (name === 'grandson-voirie') {
      this.reportingService = 'Commune de Grandson – Service Travaux et environnement';
      this.privacy =
        'Local telephone-note preparation collects no reporter contacts or photos and makes no municipal transfer. Native reporter requirements, anonymous acceptance, incident privacy, retention, processing country and receipt remain unverified. The explicit fault invitation is by telephone; the published email is contextual. No payload, sending, external completion, tracking or native/security client execution.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: grandsonScope,
        responsibility:
          'Confirm the exact Grandson point and actual municipal maintenance responsibility; boundary and resident confirmation do not independently prove ownership.',
        routing_note:
          'Local telephone note only. No contacts or photos; no sending, external completion or tracking. Never automatically retry, recreate or switch channels after an uncertain result.',
        sources: [
          {
            title: 'Explicit communal voirie fault invitation and maintenance scope',
            url: grandsonWorksUrl,
          },
          {
            title: 'Current municipal roads and lighting responsibility',
            url: grandsonMunicipalityUrl,
          },
          {
            title: 'Works contact and duty directory; native requirements unverified',
            url: grandsonContactUrl,
          },
        ],
      };
    }
    if (name === 'essertines-voirie') {
      this.reportingService = 'Commune d’Essertines-sur-Yverdon – Voirie';
      this.privacy =
        'Local text preparation keeps required private names, phone and email and optional postal contacts in Civic, outside AI. No photos or municipal transfer. A specific incident/contact privacy policy, retention period and processing country have not been qualified. Native protection, validation, recipient delivery and receipt remain unverified. No client, trap or native state is executed or reused; no payload, sending, external completion or tracking.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: essertinesScope,
        sources: [
          {
            title: 'Official technical-problem referral and selected Voirie contact recipient',
            url: essertinesFormUrl,
          },
          { title: 'Municipal lighting and road responsibility', url: essertinesMunicipalityUrl },
        ],
      };
    }
    if (isEwrMunicipality(name)) {
      this.reportingService = `EW Romanshorn – ${this.municipality} Strassenbeleuchtung`;
      this.termsUrl = ewrPrivacyUrl;
      this.privacy =
        'Required private combined name, phone and email remain outside AI. No reporter address, photos or PDF email fallback. Native storage/processing consent required. Policy17October2024 covers communication/fault handling, service providers/partners/authorities and foreign processing with exceptions; purpose/legal/technical retention, business communication up to ten years, no fixed lamp period. No native client/protection execution, payload, sending or tracking.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: ewrScope(name),
        sources: [
          {
            title: 'EWR public-lighting mandate for three municipalities',
            url: 'https://ewr.ch/dienstleistungen/oeffentliche-beleuchtung/',
          },
          { title: 'Dedicated EWR lighting fault form', url: ewrFormUrl },
          { title: 'EWR privacy policy', url: ewrPrivacyUrl },
        ],
      };
    }
    if (isReaMunicipality(name)) {
      this.reportingService = `Regio Energie Amriswil – ${this.municipality} Strassenbeleuchtung`;
      this.termsUrl = reaPrivacyUrl;
      this.privacy =
        'Optional reporter name, postcode, phone and email remain outside AI; no photos. Local preparation separates lamp number and reporter name despite their duplicate native binding. Policy processes enquiries and allows service-provider/partner/authority sharing and conditional foreign processing, with purpose/legal retention and no fixed lamp period or absolute transmission-security promise. No native client/anti-spam/state execution, payload, sending, status request or tracking.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: reaScope(name),
        sources: [
          { title: 'Official municipal utility referral', url: reaMunicipalities[name].referral },
          { title: 'Dedicated REA lighting fault form', url: reaFormUrl },
          { title: 'REA privacy policy 1 June 2026', url: reaPrivacyUrl },
        ],
      };
    }
    if (isEgsMunicipality(name)) {
      this.reportingService = `Elektrizitäts-Genossenschaft Siggenthal – ${this.municipality} Strassenbeleuchtung`;
      this.privacy =
        'Local preparation keeps required private salutation, names, phone/email and optional company outside AI; no photos or postal contacts. Provider/partner/authority sharing and foreign-processing conditions apply, with no fixed lamp-report retention established. Native reCAPTCHA, phone geoIP, UUID/consent behavior, phone normalization and actual acceptance remain unverified. Civic performs no native initialization, code execution, payload or sending.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: egsScope(name),
        sources: [
          { title: 'Municipal EGS referral', url: egsMunicipalities[name].referral },
          { title: 'Dedicated EGS two-municipality lamp form', url: egsFormUrl },
          {
            title: 'Official provider privacy PDF; native delivery details unresolved',
            url: egsPrivacyUrl,
          },
        ],
      };
    }
    if (name === 'eww-wettingen') {
      this.reportingService = 'Energie Wettingen – Öffentliche Beleuchtung';
      this.privacy =
        'Local text-only preparation keeps private salutation, split names, email and optional phone/postal contacts outside AI. General inquiry/follow-up, existing customer-data and possible quality-review purposes; service-provider/partner/authority sharing and foreign safeguards, no fixed lamp/photo retention or publication promise. Native protection/fingerprint, tracking consent, upload MIME, email pattern and durable acceptance remain unverified. No native execution or sending.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: ewwScope,
        sources: [
          {
            title: 'Official utility public-lighting mandate and sole municipal ownership',
            url: ewwIdentityUrl,
          },
          { title: 'Dedicated ordinary lamp-fault form', url: ewwFormUrl },
          { title: 'Provider privacy January2026', url: ewwPrivacyUrl },
        ],
      };
    }
    if (name === 'egm-muelligen') {
      this.reportingService = 'EGM Mülligen – öffentliche Beleuchtung';
      this.privacy =
        'Text-only local preparation keeps required private split names/email/privacy agreement and optional company outside AI. Lamp street/postcode/locality describe the asset, not the reporter. No private postal/phone fields or attachments. General form policy lists contact fields absent from this selected form. Form-purpose processing, broader marketing/statistics with objection rights, partner/provider/authority and foreign sharing; no fixed lamp retention/publication promise. Native email confirmation, CAPTCHA, upload and durable acceptance remain unverified. No native state reuse, client execution or sending.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: egmScope,
        sources: [
          {
            title: 'Operator explicit public-lighting mandate within Mülligen',
            url: egmIdentityUrl,
          },
          { title: 'Dedicated ordinary lamp-fault form', url: egmFormUrl },
          { title: 'Provider privacy policy', url: egmPrivacyUrl },
        ],
      };
    }
    if (name === 'ibw-wohlen-ag') {
      this.reportingService = 'ibw – Öffentliche Beleuchtung Wohlen AG';
      this.privacy =
        'Local text-only preparation keeps required private split names/email/privacy acknowledgement and optional salutation/phone outside AI. No private postal fields or photos. General contact-policy postal fields do not occur in the actual lamp form. Form-purpose processing plus broader marketing/statistics with objection rights, group/provider/authority sharing and foreign safeguards; no fixed lamp-specific retention or publication promise. Native protection and actual receipt/reconciliation remain unverified; no client execution, state reuse or sending.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: ibwScope,
        sources: [
          { title: 'Official explicit Wohlen AG public-lighting mandate', url: ibwIdentityUrl },
          { title: 'Dedicated ordinary lamp-fault form', url: ibwFormUrl },
          { title: 'Complete provider privacy policy', url: ibwPrivacyUrl },
        ],
      };
    }
    if (name === 'swl-staufen') {
      this.reportingService = 'SWL Energie AG – Staufen streetlighting';
      this.privacy =
        'Telephone-only local preparation keeps private names, salutation and phone outside AI. No reporter postal address, email, company or photos. SWL processes inquiries with contracted-provider/legal sharing exceptions and purpose/legal retention. Native form uses hCaptcha while its policy describes reCAPTCHA; protection data flow remains unverified. Local read acknowledgement is not a native consent checkbox. Nothing is sent; delivery and acceptance are unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: swlScope,
        sources: [
          { title: 'Explicit municipal broken-lamp referral', url: swlReferralUrl },
          { title: 'Current municipal electricity and SWL referral', url: swlElectricityUrl },
          { title: 'Native lamp fault form', url: swlLightingFormUrl },
          {
            title: 'Provider privacy; protection discrepancy unresolved',
            url: swlLightingPrivacyUrl,
          },
        ],
      };
    }
    if (name === 'zofingen-infrastructure') {
      this.reportingService = 'Stadt Zofingen – Gemeindeinfrastruktur';
      this.termsUrl = zofingenPrivacyUrl;
      this.privacy =
        'Private full name, daytime phone and email remain outside AI. Native photo optional; local preparation accepts no attachments. Policy stores enquiries/contact details for processing and follow-up, says no sharing without consent, and disclaims complete transmission security. No fixed incident retention; general account/newsletter/payment terms not incident terms. Local read acknowledgement is not a native consent checkbox. No client/state/protection execution or sending; acceptance unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: zofingenScope,
        sources: [
          { title: 'Dedicated municipal infrastructure-damage form', url: zofingenFormUrl },
          { title: 'Official municipal maintenance duties', url: zofingenReferralUrl },
          { title: 'Municipal privacy policy', url: zofingenPrivacyUrl },
        ],
      };
    }
    if (name === 'tbw-weinfelden') {
      this.reportingService = 'TBW – Weinfelden public streetlighting';
      this.termsUrl = tbwPrivacyUrl;
      this.privacy =
        'Private salutation, names, street/house number, postcode/locality, mobile, email, optional phone and postbox remain outside AI. Native privacy acknowledgement required. No photos. Policy effective 22 September 2026 describes form handling/answers and hosting, with broader service/contract/legal sharing. Swiss website hosting is not an all-incident residency guarantee; possible EEA/worldwide processing. No fixed incident retention. Portal reCAPTCHA policy does not establish public contact-form behavior. No native state, trap/client execution, payload, sending or external completion; acceptance unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: tbwScope,
        sources: [
          { title: 'Public TBW contact form', url: tbwFormUrl },
          {
            title: 'Explicit city lighting mandate and unlit-lamp reporting invitation',
            url: tbwReferralUrl,
          },
          { title: 'TBW privacy policy', url: tbwPrivacyUrl },
          {
            title: 'City normal lighting shutdown hours',
            url: 'https://www.weinfelden.ch/stadt/news/aktuell.html/310/news/9529/newsarchive/1',
          },
        ],
      };
    }
    if (name === 'diessenhofen-stadtmelder') {
      this.reportingService = 'Stadtgemeinde Diessenhofen – Stadtmelder';
      this.privacy =
        'Private names, street, optional house number, postcode/locality, email and optional phone remain outside AI. No photos. Policy stores contact-form enquiries for processing and follow-up; no fixed incident retention. Local policy-read acknowledgement is not native consent. No client/protection execution, payload, external completion or sending; acceptance unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: diessenhofenScope,
        sources: [
          { title: 'Municipal general feedback form', url: diessenhofenFormUrl },
          {
            title: 'Official municipal public-space maintenance duties',
            url: diessenhofenReferralUrl,
          },
          { title: 'Municipal privacy policy', url: diessenhofenPrivacyUrl },
        ],
      };
    }
    if (name === 'obermumpf-lighting') {
      this.reportingService = 'Gemeinde Obermumpf – Strassenbeleuchtung';
      this.privacy =
        'Private names, full address, phone and email remain outside AI. Native lamp number is optional; no photos. Policy stores contact-form enquiries for processing and follow-up, with consent-based sharing and no guaranteed transmission security. No fixed lamp retention. Local read acknowledgement is not a native consent checkbox. No client/state/protection execution or sending; acceptance unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-20',
        scope: obermumpfScope,
        sources: [
          { title: 'Dedicated municipal lamp form', url: obermumpfFormUrl },
          {
            title: 'Explicit municipal lamp-maintenance and reporting responsibility',
            url: obermumpfReferralUrl,
          },
          { title: 'Municipal privacy policy', url: obermumpfPrivacyUrl },
        ],
      };
    }
    if (name === 'elektra-auw') {
      this.reportingService = 'Elektra Genossenschaft Auw – public streetlighting';
      this.privacy =
        'Local preparation keeps private combined reporter name, address/locality and phone outside AI. No email or photos. Provider processing is for service purposes, with contracted-provider/business-partner/legal disclosure exceptions and possible foreign recipients. No fixed lamp retention or absolute confidentiality promise. Local privacy-read acknowledgement is not a native consent checkbox. No native client/state/nonce execution or transmission; delivery and acceptance remain unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: auwScope,
        sources: [
          { title: 'Official municipal Elektra referral', url: auwReferralUrl },
          { title: 'Dedicated native street/pavement lamp fault form', url: auwFormUrl },
          { title: 'Provider privacy PDF', url: auwPrivacyUrl },
        ],
      };
    }
    if (name === 'tbseon-egliswil') {
      this.reportingService = 'Technische Betriebe Seon AG – Egliswil Strassenbeleuchtung';
      this.privacy =
        'Telephone-only local preparation keeps private names, address, postcode/locality and phone outside AI. No email or photos. Provider confidentiality is qualified by service-provider/legal sharing and required business-record retention; no fixed lamp retention or publication promise. Local privacy acknowledgement is not a native checkbox. Civic sends nothing during local preparation; actual delivery and acceptance remain unverified.';
      this.guidance = {
        ...this.guidance,
        verified_on: '2026-10-19',
        scope: tbseonScope,
        sources: [
          { title: 'Explicit municipal streetlight fault referral', url: tbseonReferralUrl },
          { title: 'Native shared customer form, lamp branch', url: tbseonFormUrl },
          { title: 'Provider privacy policy', url: tbseonPrivacyUrl },
        ],
      };
    }
  }
  mapUrl(point: Point) {
    coordinates.parse(point);
    return this.placeMapUrl
      .replace('{longitude}', String(point.longitude))
      .replace('{latitude}', String(point.latitude));
  }
  fallbackUrl(_input: ReportInput) {
    if (this.name === 'ostermundigen')
      return (
        Object.values(ostermundigenForms).find((f) => f.category === _input.category)?.url ??
        this.reportingUrl
      );
    return this.reportingUrl;
  }
  reportUrl(_id: string): string {
    if (this.name === 'ebikon' || this.name === 'meggen') return oneGovReportUrl(this.name, _id);
    throw new Error('Public report linking is unverified for this municipality.');
  }
  geocode(query: string) {
    return new CityClient(this.request).geocode(query);
  }
  categories() {
    if (isEwrMunicipality(this.name)) return Promise.resolve(ewrCategories.map((c) => ({ ...c })));
    if (isReaMunicipality(this.name)) return Promise.resolve(reaCategories.map((c) => ({ ...c })));
    if (isSieMunicipality(this.name)) return Promise.resolve(sieCategories.map((c) => ({ ...c })));
    if (this.name === 'rivaz-water') return Promise.resolve(rivazCategories.map((c) => ({ ...c })));
    if (this.name === 'grandson-voirie')
      return Promise.resolve(grandsonCategories.map((c) => ({ ...c })));
    if (this.name === 'essertines-voirie')
      return Promise.resolve(essertinesCategories.map((c) => ({ ...c })));
    if (this.name === 'zofingen-infrastructure')
      return Promise.resolve(zofingenCategories.map((c) => ({ ...c })));
    if (this.name === 'tbw-weinfelden')
      return Promise.resolve(tbwCategories.map((c) => ({ ...c })));
    if (this.name === 'diessenhofen-stadtmelder')
      return Promise.resolve(diessenhofenCategories.map((c) => ({ ...c })));
    if (this.name === 'obermumpf-lighting')
      return Promise.resolve(obermumpfCategories.map((c) => ({ ...c })));
    if (this.name === 'elektra-auw') return Promise.resolve(auwCategories.map((c) => ({ ...c })));
    if (this.name === 'swl-staufen') return Promise.resolve(swlCategories.map((c) => ({ ...c })));
    if (this.name === 'tbseon-egliswil')
      return Promise.resolve(tbseonCategories.map((c) => ({ ...c })));
    // Published metadata only; EGS source reads require the exact point gate.
    if (this.name === 'rwb-windisch') return Promise.resolve(rwbCategories.map((c) => ({ ...c })));
    if (this.name === 'egm-muelligen') return Promise.resolve(egmCategories.map((c) => ({ ...c })));
    if (this.name === 'ibw-wohlen-ag') return Promise.resolve(ibwCategories.map((c) => ({ ...c })));
    if (this.name === 'eww-wettingen') return Promise.resolve(ewwCategories.map((c) => ({ ...c })));
    if (isEgsMunicipality(this.name)) return Promise.resolve(egsCategories.map((c) => ({ ...c })));
    return this.loadCategories(false);
  }
  private async loadCategories(fresh: boolean): Promise<Category[]> {
    if (isSieMunicipality(this.name)) assertSieSourcesAvailable(this.request);
    if (this.name === 'rivaz-water') assertRivazSourcesAvailable(this.request);
    if (this.name === 'grandson-voirie') assertGrandsonSourcesAvailable(this.request);
    if (this.name === 'essertines-voirie') assertEssertinesSourcesAvailable(this.request);
    if (isEwrMunicipality(this.name)) assertEwrSourcesAvailable(this.request);
    if (isReaMunicipality(this.name)) assertReaSourcesAvailable(this.request);
    if (this.name === 'zofingen-infrastructure') assertZofingenSourcesAvailable(this.request);
    if (this.name === 'tbw-weinfelden') assertTbwSourcesAvailable(this.request);
    if (this.name === 'diessenhofen-stadtmelder') assertDiessenhofenSourcesAvailable(this.request);
    if (this.name === 'obermumpf-lighting') assertObermumpfSourcesAvailable(this.request);
    if (this.name === 'elektra-auw') assertAuwSourcesAvailable(this.request);
    if (this.name === 'swl-staufen') assertSwlSourcesAvailable(this.request);
    if (this.name === 'tbseon-egliswil') assertTbseonSourcesAvailable(this.request);
    if (this.name === 'rwb-windisch') assertRwbWindischSourcesAvailable(this.request);
    if (this.name === 'egm-muelligen') assertEgmSourcesAvailable(this.request);
    if (this.name === 'ibw-wohlen-ag') assertIbwSourcesAvailable(this.request, this.now);
    if (this.name === 'eww-wettingen') assertEwwSourcesAvailable(this.request, this.now);
    if (isEgsMunicipality(this.name)) assertEgsSourcesAvailable(this.request, this.now);
    if (this.retryAt > this.now()) throw changed();
    if (!fresh && this.cached && this.cached.expires > this.now())
      return structuredClone(this.cached.value);
    if (!this.pending)
      this.pending = (async () => {
        try {
          if (
            isEwrMunicipality(this.name) ||
            isReaMunicipality(this.name) ||
            this.name === 'zofingen-infrastructure' ||
            this.name === 'tbw-weinfelden' ||
            this.name === 'diessenhofen-stadtmelder' ||
            this.name === 'obermumpf-lighting' ||
            this.name === 'swl-staufen' ||
            this.name === 'elektra-auw' ||
            this.name === 'tbseon-egliswil' ||
            this.name === 'egm-muelligen' ||
            this.name === 'ibw-wohlen-ag' ||
            this.name === 'eww-wettingen' ||
            isEgsMunicipality(this.name) ||
            this.name === 'ewn-neuenhof' ||
            this.name === 'rwb-ennetbaden' ||
            this.name === 'rwb-windisch' ||
            this.name === 'hornet-aarau' ||
            this.name === 'tbgraenichen' ||
            this.name === 'tbs-suhr'
          ) {
            const value = await (
              isEwrMunicipality(this.name)
                ? loadEwrCategories
                : isReaMunicipality(this.name)
                  ? loadReaCategories
                  : this.name === 'zofingen-infrastructure'
                    ? loadZofingenCategories
                    : this.name === 'tbw-weinfelden'
                      ? loadTbwCategories
                      : this.name === 'diessenhofen-stadtmelder'
                        ? loadDiessenhofenCategories
                        : this.name === 'obermumpf-lighting'
                          ? loadObermumpfCategories
                          : this.name === 'elektra-auw'
                            ? loadAuwCategories
                            : this.name === 'swl-staufen'
                              ? loadSwlCategories
                              : this.name === 'tbseon-egliswil'
                                ? loadTbseonCategories
                                : this.name === 'egm-muelligen'
                                  ? loadEgmCategories
                                  : this.name === 'ibw-wohlen-ag'
                                    ? loadIbwCategories
                                    : this.name === 'eww-wettingen'
                                      ? loadEwwCategories
                                      : isEgsMunicipality(this.name)
                                        ? loadEgsCategories
                                        : this.name === 'ewn-neuenhof'
                                          ? loadEwnCategories
                                          : this.name === 'rwb-windisch'
                                            ? loadRwbWindischCategories
                                            : this.name === 'rwb-ennetbaden'
                                              ? loadRwbCategories
                                              : this.name === 'hornet-aarau'
                                                ? loadHornetCategories
                                                : this.name === 'tbs-suhr'
                                                  ? loadTbsCategories
                                                  : loadTbgraenichenCategories
            )(
              this.request,
              (delay) => {
                this.retryAt = Math.max(
                  this.retryAt,
                  this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
                );
              },
              this.now,
            );
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (isSieMunicipality(this.name)) {
            const value = await loadSieCategories(
              this.request,
              (delay) => {
                this.retryAt = Math.max(
                  this.retryAt,
                  this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
                );
              },
              this.now,
            );
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (this.name === 'rivaz-water') {
            const value = await loadRivazCategories(
              this.request,
              (delay) => {
                this.retryAt = Math.max(
                  this.retryAt,
                  this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
                );
              },
              this.now,
            );
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (this.name === 'grandson-voirie') {
            const value = await loadGrandsonCategories(
              this.request,
              (delay) => {
                this.retryAt = Math.max(
                  this.retryAt,
                  this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
                );
              },
              this.now,
            );
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (this.name === 'essertines-voirie') {
            const value = await loadEssertinesCategories(
              this.request,
              (delay) => {
                this.retryAt = Math.max(
                  this.retryAt,
                  this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
                );
              },
              this.now,
            );
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (this.name === 'lungern') {
            const value = await loadLungernCategories(
              this.request,
              (delay) => {
                this.retryAt = Math.max(
                  this.retryAt,
                  this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
                );
              },
              this.now,
            );
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (this.name === 'staefa') {
            const value = await loadStaefaCategories(this.request, (delay) => {
              this.retryAt = Math.max(
                this.retryAt,
                this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
              );
            });
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          if (this.name === 'ostermundigen') {
            const value: Category[] = [];
            for (const kind of ['lighting', 'road'] as const) {
              const response = await this.request(ostermundigenForms[kind].url, {
                method: 'GET',
                redirect: 'error',
                signal: AbortSignal.timeout(20_000),
                headers: {
                  Accept: 'text/html',
                  'User-Agent': 'Civic municipal form preparation (read-only)',
                },
              });
              if (!response.ok) {
                const header = response.headers.get('retry-after') ?? '';
                const delay = /^\d+$/.test(header)
                  ? Number(header) * 1000
                  : Date.parse(header) - this.now();
                if (Number.isFinite(delay) && delay > 0)
                  this.retryAt = this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now());
              }
              value.push(...inspectOstermundigenForm(kind, await readHtml(response)));
            }
            this.cached = { value, expires: this.now() + 300_000 };
            return value;
          }
          const response = await this.request(this.reportFormUrl, {
            method: 'GET',
            redirect: 'error',
            signal: AbortSignal.timeout(20_000),
            headers: {
              Accept: 'text/html',
              'User-Agent': 'Civic municipal form preparation (read-only)',
            },
          });
          if (!response.ok) {
            const header = response.headers.get('retry-after') ?? '';
            const delay = /^\d+$/.test(header)
              ? Number(header) * 1000
              : Date.parse(header) - this.now();
            if (Number.isFinite(delay) && delay > 0)
              this.retryAt = this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now());
          }
          const value = inspectMunicipalForm(this.name, await readHtml(response));
          this.cached = { value, expires: this.now() + 300_000 };
          return value;
        } catch (error) {
          this.cached = undefined;
          this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
          throw error;
        }
      })().finally(() => {
        this.pending = undefined;
      });
    return structuredClone(await this.pending);
  }
  async requirements(
    point: Point,
    options: { fresh?: boolean } = {},
  ): Promise<Record<string, Requirements>> {
    const exact = coordinates.parse(point),
      municipality = await this.places.municipality(exact);
    if (municipality?.bfs_id !== this.bfsId)
      throw new Error('The exact location is outside this municipality.');
    const cats = await this.loadCategories(options.fresh === true);
    if (this.name === 'swl-staufen') return swlRequirements();
    if (isEwrMunicipality(this.name)) return ewrRequirements(this.name);
    if (isReaMunicipality(this.name)) return reaRequirements(this.name);
    if (this.name === 'zofingen-infrastructure') return zofingenRequirements();
    if (this.name === 'tbw-weinfelden') return tbwRequirements();
    if (this.name === 'diessenhofen-stadtmelder') return diessenhofenRequirements();
    if (this.name === 'obermumpf-lighting') return obermumpfRequirements();
    if (this.name === 'elektra-auw') return auwRequirements();
    if (this.name === 'tbseon-egliswil') return tbseonRequirements();
    if (this.name === 'egm-muelligen') return egmRequirements();
    if (this.name === 'ibw-wohlen-ag') return ibwRequirements();
    if (this.name === 'eww-wettingen') return ewwRequirements();
    if (isEgsMunicipality(this.name)) return egsRequirements(this.name);
    if (this.name === 'ewn-neuenhof') return ewnRequirements();
    if (this.name === 'rwb-windisch') return rwbWindischRequirements();
    if (this.name === 'rwb-ennetbaden') return rwbRequirements();
    if (this.name === 'tbs-suhr') return tbsRequirements();
    if (this.name === 'tbgraenichen') return tbgraenichenRequirements();
    if (this.name === 'hornet-aarau') return hornetRequirements();
    if (this.name === 'rabiosa-churwalden') return rabiosaRequirements();
    if (this.name === 'ee-engiadina-scuol') return energiaEngiadinaRequirements();
    if (this.name === 'thusis') return thusisRequirements();
    if (this.name === 'falera') return faleraRequirements();
    if (this.name === 'wil-lighting') return wilLightingRequirements();
    if (isEwsennwaldMunicipality(this.name)) return ewsennwaldRequirements(this.bfsId);
    if (this.name === 'ewbuchs') return ewbuchsRequirements();
    if (this.name === 'stmargrethen') return stmargrethenRequirements();
    if (this.name === 'waldstatt') return waldstattRequirements();
    if (this.name === 'titterten') return tittertenRequirements();
    if (this.name === 'wintersingen') return wintersingenRequirements();
    if (this.name === 'therwil') return therwilRequirements();
    if (this.name === 'reinach-bl') return reinachBlRequirements();
    if (this.name === 'val-de-charmey') return valDeCharmeyRequirements();
    if (this.name === 'lungern') return lungernRequirements();
    if (isEbsMunicipality(this.name)) return ebsRequirements(this.name);
    if (this.name === 'wuennewil-flamatt') return wuennewilRequirements();
    if (this.name === 'erstfeld') return erstfeldRequirements();
    if (isCkwMunicipality(this.name)) return ckwRequirements(this.name);
    if (this.name === 'oberhofen' || this.name === 'steffisburg')
      return netzulgRequirements(this.name);
    if (this.name === 'buchsi') return buchsiRequirements();
    if (this.name === 'dotzigen') return dotzigenRequirements();
    if (this.name === 'bueren') return evbRequirements();
    if (this.name === 'ostermundigen') return ostermundigenRequirements();
    if (this.name === 'wohlen-be') return wohlenBeRequirements();
    if (this.name === 'roggwil') return roggwilRequirements();
    if (this.name === 'langenthal') return langenthalRequirements();
    if (this.name === 'staefa') return staefaRequirements();
    if (this.name === 'erlenbach' || this.name === 'zollikon')
      return wazRequirements(this.municipality);
    if (this.name === 'marthalen') return marthalenRequirements();
    if (isSieMunicipality(this.name)) return sieRequirements(this.name);
    if (this.name === 'rivaz-water') return rivazRequirements();
    if (this.name === 'grandson-voirie') return grandsonRequirements();
    if (this.name === 'essertines-voirie') return essertinesRequirements();
    if (this.name === 'boenigen') return boenigenRequirements();
    if (this.name === 'gossau') return gossauRequirements();
    if (this.name === 'meggen')
      return {
        'Meldung Sicherheitsproblem': {
          scope: this.guidance.scope,
          photo_required: false,
          email_required: true,
          phone_required: false,
          contact_fields: ['phone'],
          max_photos: 1,
          max_photo_bytes: 5_000_000,
          description_max_length: 5000,
          location_label_max_length: 250,
          bodies: [this.municipality],
          extra_fields: [
            {
              code: 'first_name',
              contact: true,
              description: 'First name',
              required: true,
              datatype: 'string',
              max_length: 200,
            },
            {
              code: 'last_name',
              contact: true,
              description: 'Last name',
              required: true,
              datatype: 'string',
              max_length: 200,
            },
            {
              code: 'parcel_address',
              description: 'Issue address or parcel number (optional)',
              required: false,
              datatype: 'string',
              max_length: 250,
            },
          ],
          notes: [
            'Nicht dringende Sicherheitsprobleme an der kommunalen Infrastruktur. Vorname, Name und E-Mail sind erforderlich; Telefon, Grundstücksangabe und ein Foto sind freiwillig.',
            'Civic benötigt einen bestätigten Standort und eine Beschreibung. Höchstens ein Foto bis 5 MB.',
          ],
        },
      };
    if (this.name === 'ebikon')
      return Object.fromEntries(
        cats.map((c) => [
          c.service_name,
          {
            scope:
              'Non-emergency damage in public spaces: ' +
              c.service_name +
              '. Street-light faults use the separate CKW route.',
            photo_required: false,
            email_required: true,
            phone_required: false,
            contact_fields: ['phone'],
            max_photos: 1,
            max_photo_bytes: 5_000_000,
            description_max_length: 400,
            location_label_max_length: 150,
            bodies: [this.municipality],
            extra_fields: [
              {
                code: 'first_name',
                contact: true,
                description: 'First name',
                required: true,
                datatype: 'string',
                max_length: 200,
              },
              {
                code: 'last_name',
                contact: true,
                description: 'Last name',
                required: true,
                datatype: 'string',
                max_length: 200,
              },
              ...(c.service_name === 'Anderer Schaden'
                ? [
                    {
                      code: 'other_damage',
                      description: 'Type of other damage (optional)',
                      required: false,
                      datatype: 'string',
                      max_length: 200,
                      translate: true,
                    },
                  ]
                : []),
            ],
            notes: [
              'Vorname, Nachname, E-Mail, Schadensart, Standort und Beschreibung sind erforderlich. Telefon und ein Foto sind freiwillig.',
              'Die Beschreibung darf höchstens 400 Zeichen, die Standortbezeichnung höchstens 150 Zeichen enthalten. Höchstens ein Foto bis 5 MB.',
            ],
          } satisfies Requirements,
        ]),
      );
    const rule: Requirements = {
      photo_required: false,
      phone_required: false,
      name_required: this.name === 'fribourg',
      contact_fields: this.name === 'fribourg' ? ['name', 'phone'] : [],
      max_photos: 1,
      bodies: [this.municipality],
      extra_fields:
        this.name === 'fribourg'
          ? [
              {
                code: 'reporter_address',
                contact: true,
                description: 'Reporter postal street address',
                required: true,
                datatype: 'string',
                max_length: 255,
              },
              {
                code: 'reporter_postcode_city',
                contact: true,
                description: 'Reporter postcode and locality',
                required: true,
                datatype: 'string',
                max_length: 255,
              },
              {
                code: 'reporter_address_2',
                contact: true,
                description: 'Additional reporter postal address (optional)',
                required: false,
                datatype: 'string',
                max_length: 255,
              },
            ]
          : [],
    };
    return Object.fromEntries(cats.map((c) => [c.service_name, structuredClone(rule)]));
  }
  async reports(): ReturnType<CityClient['reports']> {
    throw new Error('Public report lookup is unverified for this municipality.');
  }
  async report(): ReturnType<CityClient['report']> {
    throw new Error('Public tracking is unverified for this municipality.');
  }
  async nearby(): ReturnType<CityClient['nearby']> {
    throw new Error('Duplicate search is unavailable for this municipality.');
  }
  async submit(
    preview: Prepared,
  ): Promise<{ state: 'accepted' | 'rejected' | 'unknown'; report_id?: string }> {
    if (this.submissionMode !== 'direct' || (this.name !== 'ebikon' && this.name !== 'meggen'))
      throw new Error(
        'Sending is disabled until municipal upload and receipt verification is complete.',
      );
    const input = reportInput.parse(preview.input);
    if (
      preview.destination?.bfs_id !== this.bfsId ||
      preview.destination.service_id !== this.serviceId ||
      preview.terms_url !== undefined ||
      !Number.isFinite(Date.parse(preview.expires_at)) ||
      Date.parse(preview.expires_at) <= this.now()
    )
      throw new Error('Preview destination or expiry does not match this municipality.');
    const rule = (await this.requirements(input))[input.category];
    if (
      !rule ||
      !input.email ||
      input.name ||
      input.description.length > rule.description_max_length! ||
      input.location_label.length > rule.location_label_max_length! ||
      preview.photos.length > 1 ||
      input.photo_ids.length !== preview.photos.length ||
      preview.photos.some((p, i) => p.id !== input.photo_ids[i])
    )
      throw new Error('The approved preview does not match the current municipal requirements.');
    const fields = rule.extra_fields ?? [];
    if (
      Object.keys(input.extra_fields).some((key) => !fields.some((f) => f.code === key)) ||
      fields.some(
        (f) =>
          (f.required && !input.extra_fields[f.code]?.trim()) ||
          (f.max_length && (input.extra_fields[f.code]?.length ?? 0) > f.max_length),
      )
    )
      throw new Error('The approved contact or extra fields do not match this form.');
    if (this.retryAt > this.now()) throw changed();
    const result = await submitOneGov(this.name, preview, this.request, this.now, (delay) => {
      this.retryAt = Math.max(
        this.retryAt,
        this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
      );
    });
    if (result.state !== 'accepted') this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
    return result;
  }
}
