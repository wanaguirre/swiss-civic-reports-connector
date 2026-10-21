import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const simplonHomeUrl = 'https://gemeinde-simplon.ch/';
export const simplonAuthorityUrl = 'https://gemeinde-simplon.ch/gemeinderat/';
export const simplonStaffUrl = 'https://gemeinde-simplon.ch/mitarbeiter/';
export const simplonElectricityUrl = 'https://gemeinde-simplon.ch/stromversorgung/';
export const simplonRegulationUrl =
  'https://gemeinde-simplon.ch/wp-content/uploads/2021/09/Stromreglement-PDF.pdf';
export const simplonCategory = 'EVS-Zähleranzeige – lokale Fakten';
export const simplonScope =
  'Local German facts worksheet for a legitimate EVS customer’s actual EVS-owned electricity meter at its exact Simplon VS BFS6009 point, with an already observed independently established NONURGENT DISPLAY irregularity. Published electricity regulation13.1 identifies utility-owned meters;13.6 asks customers to notify observed functional irregularities without delay. These local facts do not perform that notification, establish legal compliance or extend any deadline, and must not delay required notification. This worksheet does not establish urgency or safety. Exact point alone proves neither customer relationship, EVS meter ownership, observation nor nonurgency; require a separate local customer/actual-meter/existing-nonurgent-display confirmation, not verified official requiredness or account validation. Existing facts and uncertainty only. Exclude any suspected electrical safety symptom, heat, noise, sparks, smoke, smell, damaged enclosure/seal/cable, outage or supply problem, switching/control/fuse/cable devices or other assets, billing/accuracy/calibration disputes, connection/account changes, medical concerns and repair/removal requests. No new approach, inspection, reading, testing, photograph, handling, unsealing, dismantling or repair requested. No diagnosis, safety, urgency, legal, tariff, accuracy or cost promise. No reporter contacts, account/customer/meter serial identifiers, photos, clinical/native fields, consent, client state, payload, mail/call preparation, sending, external completion or tracking. Official identity/photo/privacy/retention/country/forwarding/guest or anonymous acceptance/receipt remain unqualified. Historical1995–1996/2012 regulation dates are distinct from2018 metadata and2021 upload; no current legal validity or tariff guarantee. Undated authority and operator contacts establish no individual native meter-intake mandate. EnBAG supply affiliation is not a shared lighting or meter-report mandate; known provider restrictions remain binding. This is not a complete official form. Never automatically retry, recreate or change channel after uncertainty; no office, EVS staff, member, substitute, phone, contractor, EnBAG or provider fallback.';
export const simplonCategories = Object.freeze([
  Object.freeze({ service_code: simplonCategory, service_name: simplonCategory }),
]);
export const simplonSourcePins = Object.freeze(
  [
    {
      url: 'https://gemeinde-simplon.ch/robots.txt',
      sha256: 'c71eabc555ea7a55ce7ca7c2bdc3c48d7527d120d032c2cfea5c674b1c9e8352',
      plain: true,
    },
    {
      url: 'https://gemeinde-simplon.ch/',
      sha256: '0db4f31558f9df3540deef943590af467a3edf60d329c780e8289745c7184cd3',
      plain: false,
    },
    {
      url: 'https://gemeinde-simplon.ch/gemeinderat/',
      sha256: '9db898aa5164474b52f61a2b4eaafc19e242edfeaf9543784591c0fa006fb721',
      plain: false,
    },
    {
      url: 'https://gemeinde-simplon.ch/mitarbeiter/',
      sha256: '1a17008b228a887682c39f4c59d33f3f281ba9b77123698eadc8a44f53ed6931',
      plain: false,
    },
    {
      url: 'https://gemeinde-simplon.ch/stromversorgung/',
      sha256: 'bbc3cd364a8293ea44d9f22bef58acb25661d5c8c82e532f78aa0ec8803ddf64',
      plain: false,
    },
    {
      url: 'https://gemeinde-simplon.ch/wp-content/uploads/2021/09/Stromreglement-PDF.pdf',
      sha256: 'd60ca8154d43b42d1864feee645342325b180b5811a74a24da94cfac3461dd00',
      plain: false,
      pdf: true as const,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(simplonSourcePins);
export const inspectSimplonSource = verifier.inspect;
export const assertSimplonSourcesAvailable = verifier.assertAvailable;
export async function verifySimplonSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return simplonCategories.map((c) => ({ ...c }));
}
export const loadSimplonCategories = verifySimplonSources;
export function simplonRequirements(): Record<string, Requirements> {
  return {
    [simplonCategory]: {
      scope:
        'Local German facts worksheet for a legitimate EVS customer’s actual EVS-owned electricity meter at its exact Simplon VS BFS6009 point, with an already observed independently established NONURGENT DISPLAY irregularity. Published electricity regulation13.1 identifies utility-owned meters;13.6 asks customers to notify observed functional irregularities without delay. These local facts do not perform that notification, establish legal compliance or extend any deadline, and must not delay required notification. This worksheet does not establish urgency or safety. Exact point alone proves neither customer relationship, EVS meter ownership, observation nor nonurgency; require a separate local customer/actual-meter/existing-nonurgent-display confirmation, not verified official requiredness or account validation. Existing facts and uncertainty only. Exclude any suspected electrical safety symptom, heat, noise, sparks, smoke, smell, damaged enclosure/seal/cable, outage or supply problem, switching/control/fuse/cable devices or other assets, billing/accuracy/calibration disputes, connection/account changes, medical concerns and repair/removal requests. No new approach, inspection, reading, testing, photograph, handling, unsealing, dismantling or repair requested. No diagnosis, safety, urgency, legal, tariff, accuracy or cost promise. No reporter contacts, account/customer/meter serial identifiers, photos, clinical/native fields, consent, client state, payload, mail/call preparation, sending, external completion or tracking. Official identity/photo/privacy/retention/country/forwarding/guest or anonymous acceptance/receipt remain unqualified. Historical1995–1996/2012 regulation dates are distinct from2018 metadata and2021 upload; no current legal validity or tariff guarantee. Undated authority and operator contacts establish no individual native meter-intake mandate. EnBAG supply affiliation is not a shared lighting or meter-report mandate; known provider restrictions remain binding. This is not a complete official form. Never automatically retry, recreate or change channel after uncertainty; no office, EVS staff, member, substitute, phone, contractor, EnBAG or provider fallback.',
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Elektrizitätsversorgung Simplon EVS – lokale Zähleranzeige-Fakten'],
      extra_fields: [
        {
          code: 'evs_meter_observation_confirmed',
          description:
            'Confirm legitimate EVS customer, actual EVS-owned meter at exact Simplon point and existing independently nonurgent display facts; no safety assessment or notification performed',
          required: true,
          datatype: 'string',
          values: [
            'Legitimate EVS customer confirms actual EVS-owned meter at exact Simplon point and already observed independently established nonurgent display irregularity; no inspection, safety assessment or official notification performed',
          ],
        },
      ],
      notes: [
        'Lokale deutsche Fakten für eine bereits beobachtete, unabhängig als nicht dringend festgestellte Unregelmässigkeit der ANZEIGE eines tatsächlichen EVS-eigenen Zählers am genauen Ort in Simplon. Nur berechtigte EVS-Kunden und bereits bestehende Fakten mit Unsicherheiten. Die Bestätigung ist eine lokale Regel, kein geprüftes offizielles Feld oder Kontonachweis. Diese Fiche beurteilt weder Sicherheit noch Dringlichkeit.',
        'Artikel13.6 verlangt die Mitteilung beobachteter Funktionsunregelmässigkeiten ohne Verzug. Diese lokalen Fakten führen KEINE solche Meldung aus, begründen KEINE rechtliche Erfüllung und verlängern KEINE Frist. Die Fiche darf eine erforderliche Meldung nicht verzögern. Kein vollständiges offizielles Formular oder Ersatzkanal; keine E-Mail-Vorbereitung, Anrufe, Versand, externer Abschluss oder Nachverfolgung.',
        'Keine neue Annäherung, Inspektion, Ablesung, Prüfung, Fotografie, Handhabung, Entsiegelung, Demontage oder Reparatur erfragt. Ausgeschlossen sind vermutete elektrische Sicherheitsanzeichen, Wärme, Geräusche, Funken, Rauch, Geruch, beschädigte Gehäuse/Plomben/Kabel, Ausfälle oder Versorgungsprobleme, Schalt-/Steuer-/Sicherungs-/Kabelgeräte, andere Anlagen, Abrechnung/Genauigkeit/Eichung, Anschluss-/Kontoänderungen, medizinische Anliegen und Reparatur-/Entfernungswünsche. Keine Diagnose, Sicherheits-, Dringlichkeits-, Rechts-, Tarif- oder Kostenzusage.',
        'Keine Kontaktangaben, Konto-/Kunden-/Zählerseriennummern, Fotos, klinischen/nativen Felder oder Einwilligung erfasst. Offizielle Identität, Fotoübertragung, Datenschutz, Aufbewahrung, Verarbeitungsland, Weiterleitung, anonyme Annahme und Empfang bleiben ungeklärt. Historische Reglementsdaten sind keine Zusage aktueller Rechtsgültigkeit oder Tarife. Bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Kanal wechseln; kein Ersatz durch Büro, EVS-Mitarbeitende, Mitglied, Stellvertretung, Telefon, Unternehmer, EnBAG oder Anbieter.',
      ],
    },
  };
}
