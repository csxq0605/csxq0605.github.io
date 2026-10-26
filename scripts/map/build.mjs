// Builds the footprint map data in assets/data/map/ (run: npm run build).
//
// Sources (downloaded once into scripts/map/.cache/):
//   - Natural Earth 10m countries, China point of view (public domain): world layer.
//     Taiwan, Zangnan and Aksai Chin, Diaoyu Islands and the South China Sea
//     islands are drawn as part of China. Hong Kong and Macao are merged into China.
//   - Natural Earth 10m disputed areas: Kashmir, drawn uncoloured.
//   - Natural Earth 10m admin-1: provinces / states for the other countries.
//   - DataV GeoAtlas areas_v3 (AMap data, for study and exchange): China's provinces,
//     the South China Sea dashed line, and the prefectures inside each province.
//
// Output paths are SVG strings in the same Equal Earth projection for the world and
// country layers (so they line up when zooming); each province detail map has its
// own Mercator projection fitted to the inset panel.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import { geoEqualEarth, geoMercator, geoPath, geoBounds, geoArea } from 'd3-geo';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CACHE = path.join(HERE, '.cache');
const OUT = path.join(ROOT, 'assets/data/map');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const DATAV = 'https://geo.datav.aliyun.com/areas_v3/bound/';
const WIDTH = 1000;
const INSET = { width: 400, height: 300, pad: 14 };
// Countries that get a province / state layer (ISO alpha-2 → Natural Earth adm0_a3).
const ADMIN1 = { JP: 'JPN', US: 'USA', MY: 'MYS' };
// English names for China's 34 province-level units, keyed by adcode.
const CN_NAMES = {
  110000: 'Beijing', 120000: 'Tianjin', 130000: 'Hebei', 140000: 'Shanxi', 150000: 'Inner Mongolia',
  210000: 'Liaoning', 220000: 'Jilin', 230000: 'Heilongjiang', 310000: 'Shanghai', 320000: 'Jiangsu',
  330000: 'Zhejiang', 340000: 'Anhui', 350000: 'Fujian', 360000: 'Jiangxi', 370000: 'Shandong',
  410000: 'Henan', 420000: 'Hubei', 430000: 'Hunan', 440000: 'Guangdong', 450000: 'Guangxi',
  460000: 'Hainan', 500000: 'Chongqing', 510000: 'Sichuan', 520000: 'Guizhou', 530000: 'Yunnan',
  540000: 'Tibet', 610000: 'Shaanxi', 620000: 'Gansu', 630000: 'Qinghai', 640000: 'Ningxia',
  650000: 'Xinjiang', 710000: 'Taiwan', 810000: 'Hong Kong', 820000: 'Macao',
};

async function cached(name, url) {
  const file = path.join(CACHE, name);
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, text);
  return JSON.parse(text);
}

// Run mapshaper commands on one GeoJSON input and return the GeoJSON result.
async function shape(input, commands) {
  const out = await mapshaper.applyCommands(`-i in.json ${commands} -o out.json format=geojson`, { 'in.json': input });
  let json = JSON.parse(out['out.json']);
  // A layer without attributes comes back as a bare GeometryCollection.
  if (json.type === 'GeometryCollection') {
    json = { type: 'FeatureCollection', features: json.geometries.map(geometry => ({ type: 'Feature', properties: {}, geometry })) };
  }
  json.features.forEach(rewind);
  return json;
}

// d3-geo expects clockwise outer rings; a ring wound the other way is read as
// "the whole sphere except this shape". Reverse any polygon that covers more
// than a hemisphere.
function rewind(feature) {
  const g = feature.geometry;
  if (!g) return;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const rings of polygons) {
    if (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) rings.forEach(ring => ring.reverse());
  }
}

const r = n => Math.round(n * 10) / 10;
function box(pathGen, feature) {
  const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
  return [r(x0), r(y0), r(x1), r(y1)];
}
async function write(name, data) {
  const file = path.join(OUT, name);
  await fs.writeFile(file, JSON.stringify(data));
  return (await fs.stat(file)).size;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const report = [];

  // World layer ------------------------------------------------------------
  const countriesSrc = await cached('ne_10m_admin_0_countries_chn.geojson', NE + 'ne_10m_admin_0_countries_chn.geojson');
  // China keeps every island (South China Sea islands, Diaoyu Islands); in other
  // large countries islands under 600 km² are dropped to keep the file small.
  const china = await shape(countriesSrc, [
    '-filter "[\'CHN\', \'HKG\', \'MAC\'].indexOf(ADM0_A3) > -1"',
    '-each "ADM0_A3 = \'CHN\'; ISO_A2_EH = \'CN\'; NAME = \'China\'"',
    '-dissolve ADM0_A3 copy-fields=ISO_A2_EH,NAME',
    '-simplify 1.5% keep-shapes',
  ].join(' '));
  const notChina = '[\'ATA\', \'CHN\', \'HKG\', \'MAC\'].indexOf(ADM0_A3) == -1';
  const others = await shape(countriesSrc, [
    `-filter "${notChina} && this.area > 5e9"`,
    '-filter-fields ADM0_A3,ISO_A2_EH,NAME',
    '-filter-islands min-area=600km2',
    '-simplify 0.6% keep-shapes',
  ].join(' '));
  // Small countries (Singapore, Malta, island states) keep all their land.
  const small = await shape(countriesSrc, [
    `-filter "${notChina} && this.area <= 5e9"`,
    '-filter-fields ADM0_A3,ISO_A2_EH,NAME',
    '-simplify 0.6% keep-shapes',
  ].join(' '));
  const world = { type: 'FeatureCollection', features: [...others.features, ...small.features, ...china.features] };
  const disputed = await cached('ne_10m_admin_0_disputed_areas.geojson', NE + 'ne_10m_admin_0_disputed_areas.geojson');
  const kashmir = await shape(disputed, [
    '-filter "[\'Jammu and Kashmir\', \'Gilgit-Baltistan\', \'Azad Kashmir\', \'Siachen Glacier\'].indexOf(BRK_NAME) > -1"',
    '-dissolve',
    '-simplify 2% keep-shapes',
  ].join(' '));
  const cnSrc = await cached('datav_100000_full.json', DATAV + '100000_full.json');
  const dashSrc = { type: 'FeatureCollection', features: cnSrc.features.filter(f => f.properties.adcode === '100000_JD').map(f => JSON.parse(JSON.stringify(f))) };
  dashSrc.features.forEach(rewind);

  const projection = geoEqualEarth().fitWidth(WIDTH, world);
  const worldPath = geoPath(projection).digits(1);
  const [[, top], [, bottom]] = worldPath.bounds(world);
  const height = Math.ceil(bottom - Math.min(0, top));
  const proj = { scale: projection.scale(), translate: projection.translate() };
  const countries = world.features.map(f => {
    const iso = f.properties.ISO_A2_EH;
    return {
      id: iso && iso !== '-99' ? iso : f.properties.ADM0_A3,
      name: f.properties.NAME,
      d: worldPath(f),
      box: box(worldPath, f),
      area: Math.round(geoArea(f) * 1e6),
      c: worldPath.centroid(f).map(r),
    };
  }).filter(c => c.d);
  report.push(['world.json', await write('world.json', {
    width: WIDTH, height, projection: proj, countries,
    kashmir: worldPath(kashmir.features[0]),
    dash: worldPath(dashSrc),
  })]);

  // China provinces (DataV), same projection --------------------------------
  const cnLayer = geoPath(projection).digits(2);
  const provinces = await shape({ type: 'FeatureCollection', features: cnSrc.features.filter(f => f.properties.adcode !== '100000_JD') },
    '-filter-fields adcode,name -simplify 7% keep-shapes');
  const cnFeatures = provinces.features.map(f => ({
    id: String(f.properties.adcode),
    name: CN_NAMES[f.properties.adcode] || f.properties.name,
    zh: f.properties.name,
    d: cnLayer(f),
    box: box(cnLayer, f),
    c: cnLayer.centroid(f).map(r),
  }));
  const mainland = { type: 'FeatureCollection', features: provinces.features };
  report.push(['cn.json', await write('cn.json', {
    id: 'CN', regions: cnFeatures, dash: cnLayer(dashSrc), box: box(cnLayer, mainland),
  })]);

  // Other countries' provinces / states (Natural Earth admin-1) --------------
  const admin1 = await cached('ne_10m_admin_1_states_provinces.geojson', NE + 'ne_10m_admin_1_states_provinces.geojson');
  for (const [iso, a3] of Object.entries(ADMIN1)) {
    const states = await shape({ type: 'FeatureCollection', features: admin1.features.filter(f => f.properties.adm0_a3 === a3) },
      '-filter-fields iso_3166_2,name,name_zh -simplify 3% keep-shapes');
    const layer = geoPath(projection).digits(2);
    // Zoom to the main landmass: ignore far-off states such as Alaska and Hawaii.
    const core = states.features.filter(f => !['US-AK', 'US-HI'].includes(f.properties.iso_3166_2));
    report.push([`${iso.toLowerCase()}.json`, await write(`${iso.toLowerCase()}.json`, {
      id: iso,
      regions: states.features.map(f => ({ id: f.properties.iso_3166_2, name: f.properties.name, zh: f.properties.name_zh, d: layer(f), box: box(layer, f), c: layer.centroid(f).map(r) })),
      box: box(layer, { type: 'FeatureCollection', features: core }),
    })]);
  }

  // Province detail maps for the inset (one Mercator projection per province) --
  for (const p of cnFeatures) {
    let src;
    try { src = await cached(`datav_${p.id}_full.json`, DATAV + `${p.id}_full.json`); }
    catch { src = await cached(`datav_${p.id}.json`, DATAV + `${p.id}.json`); }   // no subdivisions (Taiwan)
    const parts = await shape(src, '-filter-fields adcode,name -simplify 6% keep-shapes');
    const fp = geoMercator().fitExtent([[INSET.pad, INSET.pad], [INSET.width - INSET.pad, INSET.height - INSET.pad]], parts);
    const inset = geoPath(fp).digits(1);
    report.push([`cn-${p.id}.json`, await write(`cn-${p.id}.json`, {
      id: p.id, name: p.name, zh: p.zh, width: INSET.width, height: INSET.height,
      parts: parts.features.map(f => ({ id: String(f.properties.adcode), zh: f.properties.name, d: inset(f), c: inset.centroid(f).map(r) })),
    })]);
  }

  const total = report.reduce((s, [, n]) => s + n, 0);
  for (const [name, size] of report) console.log(name.padEnd(18), (size / 1024).toFixed(1).padStart(7), 'KB');
  console.log('total'.padEnd(18), (total / 1024).toFixed(1).padStart(7), 'KB');
}

main().catch(error => { console.error(error); process.exit(1); });
