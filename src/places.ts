import { z } from 'zod';
import { coordinates, type Point } from './model.js';
import { distance } from './city.js';
import type { Language } from './language.js';

// Routing starts from the point, never from a chosen city. swisstopo's official
// municipal boundaries give the current municipality and its BFS number; an
// implemented adapter for that number decides whether a report can be prepared.
const IDENTIFY = 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify';
const BOUNDARIES = 'all:ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill';
const BUILDINGS = 'all:ch.bfs.gebaeude_wohnungs_register';

const boundaries = z.object({
  results: z.array(
    z.object({
      attributes: z.object({
        gemname: z.string().min(1).max(100),
        gde_nr: z.number().int().positive(),
        kanton: z.string().max(10),
        is_current_jahr: z.boolean().optional(),
      }),
    }),
  ),
});
const buildings = z.object({
  results: z.array(
    z.object({
      geometry: z
        .object({ coordinates: z.tuple([z.number().finite(), z.number().finite()]) })
        .nullish(),
      properties: z.object({
        strname_deinr: z.string().max(200).nullish(),
        plz_plz6: z.string().max(20).nullish(),
        ggdename: z.string().max(100).nullish(),
      }),
    }),
  ),
});

export type Municipality = { bfs_id: number; name: string; canton: string };
export type MunicipalAdapter = {
  readonly bfsId: number;
  readonly municipality: string;
  readonly deliveryLanguage: Language;
};
export type Place = Point & {
  label: string;
  municipality: Municipality | null;
  supported: boolean;
  delivery_language?: Language;
  official_url?: string;
};

// Citizen reporting pages on official municipal domains, from the dated research
// review completed on 5 October 2026; new Anthrazit links refreshed on 15 October.
// Shown only as a pointer for places without an adapter; never used to send.
export const OFFICIAL_PAGES_CHECKED_ON = '2026-10-05';
export const officialReportingPages: Readonly<Record<number, string>> = {
  13: 'https://www.stallikon.ch/schadenmelder',
  230: 'https://stadt.winterthur.ch/stadtmelder',
  243: 'https://dietikon.citymobile.ch/index.php?apid=631378530',
  247: 'https://m.schlieren.ch/index.php?apid=1837234',
  351: 'https://www.bern.ch/helfen/block_view',
  355: 'https://koeniz.citymobile.ch/index.php?apid=1322436301',
  544: 'https://m.moosseedorf.ch/index.php?apid=8554890',
  768: 'https://www.spiez.ch/de/verwaltung/dienstleistungen/455_gemeinde-app-mylocalservices',
  1061: 'https://dialogluzern.ch/assemblies/schadenmelden/f/498/proposals',
  2196: 'https://www.ville-fribourg.ch/on-repare',
  2701: 'https://www.bs.ch/bvd/tiefbauamt/strassenunterhalt',
  2762: 'https://allschwil.mopage.ch/index.php?apid=1207371969',
  2767: 'https://bottmingen.citymobile.ch/index.php?apid=1023155635',
  2939: 'https://m.stadt-schaffhausen.ch/index.php?apid=11652884',
  3203: 'https://m.stadt.sg.ch/index.php?apid=4507051',
  3340: 'https://www.rapperswil-jona.ch/stadtmelder',
  3427: 'https://wilsg.citymobile.ch/index.php?apid=1491079142',
  4566: 'https://frauenfeld.citymobile.ch/index.php?apid=907518245',
  5002: 'https://www.bellinzona.ch/App-della-Citta',
  5113: 'https://www.locarno.ch/it/sezione-genio-civile',
  5192: 'https://egov.lugano.ch/it/services/75/segnalazioni-ufficio-quartieri',
  5724: 'https://geocity.nyon.ch',
  6711: 'https://www.delemont.ch/fr/Votre-commune/Urbanisme-environnement-travaux-publics/Voirie/Voirie.html',
};

export class SwissPlaces {
  constructor(
    private request: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}
  private async json(parameters: Record<string, string>) {
    const url = new URL(IDENTIFY);
    url.search = new URLSearchParams({
      geometryType: 'esriGeometryPoint',
      sr: '4326',
      ...parameters,
    }).toString();
    const response = await this.request(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'zueri-wie-neu-mcp/0.4.0-rc.27 (independent civic reporting client)',
      },
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`Place lookup failed (HTTP ${response.status}). Try again later.`);
    return response.json();
  }
  async municipality(point: Point): Promise<Municipality | null> {
    coordinates.parse(point);
    const query = {
      geometry: `${point.longitude},${point.latitude}`,
      layers: BOUNDARIES,
      tolerance: '0',
      returnGeometry: 'false',
    };
    const current = (raw: unknown) =>
      boundaries
        .parse(raw)
        .results.map((r) => r.attributes)
        .find((a) => a.is_current_jahr === true);
    // The layer keeps every historical boundary. Ask for this year's first; before
    // swisstopo publishes it, the unfiltered layer still marks the current one.
    const found =
      current(
        await this.json({ ...query, timeInstant: String(new Date(this.now()).getUTCFullYear()) }),
      ) ?? current(await this.json(query));
    return found ? { bfs_id: found.gde_nr, name: found.gemname, canton: found.kanton } : null;
  }
  // The nearest registered building address, as a readable label for the point.
  async address(point: Point): Promise<string | undefined> {
    coordinates.parse(point);
    const d = 0.001;
    const raw = await this.json({
      geometry: `${point.longitude},${point.latitude}`,
      layers: BUILDINGS,
      tolerance: '20',
      mapExtent: [
        point.longitude - d,
        point.latitude - d,
        point.longitude + d,
        point.latitude + d,
      ].join(','),
      imageDisplay: '100,100,96',
      returnGeometry: 'true',
      geometryFormat: 'geojson',
      limit: '50',
    });
    const nearest = buildings
      .parse(raw)
      .results.filter((r) => r.geometry && r.properties.strname_deinr)
      .map((r) => ({
        ...r.properties,
        metres: distance(point, {
          longitude: r.geometry!.coordinates[0],
          latitude: r.geometry!.coordinates[1],
        }),
      }))
      .sort((a, b) => a.metres - b.metres)[0];
    if (!nearest) return undefined;
    const postcode = nearest.plz_plz6?.split('/')[0];
    return [nearest.strname_deinr, [postcode, nearest.ggdename].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
  }
}

export async function resolvePlace(
  places: SwissPlaces,
  adapters: readonly MunicipalAdapter[],
  point: Point,
): Promise<Place> {
  const [municipality, address] = await Promise.all([
    places.municipality(point),
    places.address(point).catch(() => undefined),
  ]);
  const adapter = municipality ? adapters.find((a) => a.bfsId === municipality.bfs_id) : undefined;
  const rounded = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  const official =
    municipality && !adapter ? officialReportingPages[municipality.bfs_id] : undefined;
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    label: address ?? (municipality ? `${municipality.name}, ${rounded}` : rounded),
    municipality,
    supported: !!adapter,
    ...(adapter ? { delivery_language: adapter.deliveryLanguage } : {}),
    ...(official ? { official_url: official } : {}),
  };
}
