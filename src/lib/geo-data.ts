import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type Geo = {
  worldCountries: FeatureCollection;
  spainProvinces: FeatureCollection;
  cataloniaProvinces: Feature[];
  costaBravaCoast: [number, number][];
  cities: { name: string; lonLat: [number, number] }[];
  airports: { id: string; name: string; lonLat: [number, number] }[];
  aves: { id: string; name: string; sub?: string; lonLat: [number, number] }[];
};

// Costa Brava endpoints (Blanes → Cap de Creus). The actual polyline is
// extracted from the Girona province boundary at runtime so it follows the
// real coastline. To change where the line starts/ends, edit the lon/lat
// pairs below: [longitude, latitude] in decimal degrees (E positive, N positive).
const COSTA_BRAVA_START: [number, number] = [2.79, 41.67]; // Blanes
const COSTA_BRAVA_END: [number, number] = [3.171, 42.432]; // Portbou (NE corner with France)

function dist2(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function extractRings(geom: Geometry): [number, number][][] {
  if (geom.type === "Polygon") return geom.coordinates.map((r) => r as [number, number][]);
  if (geom.type === "MultiPolygon")
    return geom.coordinates.flatMap((p) => p.map((r) => r as [number, number][]));
  return [];
}

function extractCostaBrava(gironaFeature: Feature): [number, number][] {
  const rings = extractRings(gironaFeature.geometry);
  let best: { ring: [number, number][]; iStart: number; iEnd: number; score: number } | null = null;
  for (const ring of rings) {
    let iS = 0;
    let iE = 0;
    let dS = Infinity;
    let dE = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const ds = dist2(ring[i], COSTA_BRAVA_START);
      const de = dist2(ring[i], COSTA_BRAVA_END);
      if (ds < dS) {
        dS = ds;
        iS = i;
      }
      if (de < dE) {
        dE = de;
        iE = i;
      }
    }
    const score = dS + dE;
    if (!best || score < best.score) best = { ring, iStart: iS, iEnd: iE, score };
  }
  if (!best) return [COSTA_BRAVA_START, COSTA_BRAVA_END];
  const { ring, iStart, iEnd } = best;
  const N = ring.length;
  const forward: [number, number][] = [];
  for (let i = iStart; i !== iEnd; i = (i + 1) % N) forward.push(ring[i]);
  forward.push(ring[iEnd]);
  const backward: [number, number][] = [];
  for (let i = iStart; i !== iEnd; i = (i - 1 + N) % N) backward.push(ring[i]);
  backward.push(ring[iEnd]);
  const pathLen = (pts: [number, number][]) => {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.sqrt(dist2(pts[i], pts[i - 1]));
    return s;
  };
  const chosen = pathLen(forward) < pathLen(backward) ? forward : backward;
  // Snap the first and last vertices to the exact requested endpoints so the
  // line always reaches the configured start/end (the ring's closest vertex
  // may be slightly off, especially at Cap de Creus).
  if (chosen.length > 0) {
    chosen[0] = COSTA_BRAVA_START;
    chosen[chosen.length - 1] = COSTA_BRAVA_END;
  }
  return chosen;
}

let cache: Promise<Geo> | null = null;

export function loadGeo(): Promise<Geo> {
  if (cache) return cache;
  cache = (async () => {
    const [worldMod, spainRes] = await Promise.all([
      import("world-atlas/countries-50m.json"),
      fetch(
        "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/spain-provinces.geojson",
      ).then((r) => r.json()),
    ]);
    // world-atlas ships TopoJSON
    const worldTopo = (worldMod as unknown as { default?: unknown }).default ?? worldMod;
    const worldCountries = feature(
      worldTopo as Parameters<typeof feature>[0],
      (worldTopo as { objects: { countries: unknown } }).objects.countries as Parameters<
        typeof feature
      >[1],
    ) as unknown as FeatureCollection;

    const spainProvinces = spainRes as FeatureCollection;
    const catalanNames = new Set(["Barcelona", "Girona", "Lleida", "Tarragona"]);
    const cataloniaProvinces = spainProvinces.features.filter((f) =>
      catalanNames.has((f.properties as { name?: string })?.name ?? ""),
    );

    const girona = cataloniaProvinces.find(
      (f) => (f.properties as { name?: string })?.name === "Girona",
    );
    const costaBravaCoast = girona ? extractCostaBrava(girona) : [COSTA_BRAVA_START, COSTA_BRAVA_END];

    return {
      worldCountries,
      spainProvinces,
      cataloniaProvinces,
      costaBravaCoast,
      cities: [
        { name: "Roses", lonLat: [3.176, 42.262] },
        { name: "L'Escala", lonLat: [3.131, 42.121] },
        { name: "Begur", lonLat: [3.21, 41.954] },
        { name: "Lloret de Mar", lonLat: [2.847, 41.7] },
        { name: "Barcelona", lonLat: [2.173, 41.385] },
      ],
      airports: [
        {
          id: "gro",
          name: "Girona–Costa Brava Airport",
          lonLat: [2.76, 41.9],
        },
        {
          id: "bcn",
          name: "Barcelona–El Prat Airport",
          lonLat: [2.08, 41.3],
        },
      ],
      aves: [
        { id: "ave-gi", name: "Girona AVE", sub: "Girona", lonLat: [2.83, 41.98] },
        { id: "ave-bcn", name: "Barcelona AVE", sub: "Barcelona", lonLat: [2.14, 41.38] },
      ],
    };
  })();
  return cache;
}

export type { Feature, FeatureCollection, Geometry };
