import test from 'node:test';
import assert from 'node:assert/strict';
import { SwissPlaces, resolvePlace, officialReportingPages } from '../dist/places.js';
import { CityClient } from '../dist/city.js';

const zurich = { latitude: 47.370183, longitude: 8.535284 };
// swisstopo keeps every historical boundary in the layer; only one is current.
const boundary = (gemname, gde_nr, kanton, current) => ({ attributes: { gemname, gde_nr, kanton, is_current_jahr: current } });
function swisstopo({ municipalities, buildings = [], currentYearEmpty = false }) {
  const calls = [];
  const places = new SwissPlaces(async url => {
    const query = new URL(String(url)).searchParams; calls.push(Object.fromEntries(query));
    assert.equal(new URL(String(url)).origin, 'https://api3.geo.admin.ch');
    if (query.get('layers').includes('gemeinde')) return Response.json({ results: currentYearEmpty && query.has('timeInstant') ? [] : municipalities });
    return Response.json({ results: buildings });
  }, () => Date.UTC(2026, 9, 9));
  return { places, calls };
}

test('the current municipality is chosen from historical boundaries and matched to an adapter by BFS number', async () => {
  const { places, calls } = swisstopo({ municipalities: [boundary('Zürich', 7700, 'ZH', false), boundary('Zürich', 261, 'ZH', true)],
    buildings: [
      { geometry: { coordinates: [8.5372, 47.3712] }, properties: { strname_deinr: 'Far Strasse 1', plz_plz6: '8001/800100', ggdename: 'Zürich' } },
      { geometry: { coordinates: [8.535219, 47.370162] }, properties: { strname_deinr: 'Basteiplatz 11', plz_plz6: '8001/800100', ggdename: 'Zürich' } },
    ] });
  const place = await resolvePlace(places, [new CityClient()], zurich);
  assert.deepEqual(place, { ...zurich, label: 'Basteiplatz 11, 8001 Zürich', municipality: { bfs_id: 261, name: 'Zürich', canton: 'ZH' },
    supported: true, delivery_language: 'de' });
  assert.equal(calls.find(c => c.layers.includes('gemeinde')).timeInstant, '2026');
});

test('an unsupported municipality is named, never routed, and offers only a researched official page', async () => {
  const winterthur = swisstopo({ municipalities: [boundary('Winterthur', 230, 'ZH', true)], currentYearEmpty: true });
  const place = await resolvePlace(winterthur.places, [new CityClient()], { latitude: 47.4995, longitude: 8.7241 });
  assert.equal(place.supported, false); assert.equal(place.delivery_language, undefined);
  assert.deepEqual(place.municipality, { bfs_id: 230, name: 'Winterthur', canton: 'ZH' });
  assert.equal(place.official_url, 'https://stadt.winterthur.ch/stadtmelder');
  assert.equal(place.label, 'Winterthur, 47.49950, 8.72410');
  // Before swisstopo publishes this year's layer, the unfiltered layer still marks the current boundary.
  assert.equal(winterthur.calls.filter(c => c.layers.includes('gemeinde')).length, 2);
  const unknown = swisstopo({ municipalities: [boundary('Aeugst am Albis', 1, 'ZH', true)] });
  assert.equal((await resolvePlace(unknown.places, [new CityClient()], { latitude: 47.27, longitude: 8.49 })).official_url, undefined);
  const abroad = swisstopo({ municipalities: [] });
  assert.deepEqual(await resolvePlace(abroad.places, [new CityClient()], { latitude: 48.85, longitude: 2.35 }),
    { latitude: 48.85, longitude: 2.35, label: '48.85000, 2.35000', municipality: null, supported: false });
});

test('a failed address lookup does not hide the municipality; a failed boundary lookup fails closed', async () => {
  const places = new SwissPlaces(async url => new URL(String(url)).searchParams.get('layers').includes('gemeinde')
    ? Response.json({ results: [boundary('Zürich', 261, 'ZH', true)] }) : new Response('down', { status: 503 }));
  assert.equal((await resolvePlace(places, [new CityClient()], zurich)).label, 'Zürich, 47.37018, 8.53528');
  const down = new SwissPlaces(async () => new Response('down', { status: 503 }));
  await assert.rejects(() => resolvePlace(down, [new CityClient()], zurich), /Place lookup failed/);
});

test('unsupported reporting-page pointers use HTTPS and exclude the implemented adapter', () => {
  for (const [id, url] of Object.entries(officialReportingPages)) {
    assert.ok(Number.isSafeInteger(Number(id)) && Number(id) > 0);
    assert.equal(new URL(url).protocol, 'https:');
    assert.equal(new URL(url).username, '');
    assert.equal(new URL(url).password, '');
  }
  assert.equal(officialReportingPages[261], undefined);
});
