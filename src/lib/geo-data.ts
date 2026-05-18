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

const COSTA_BRAVA_COAST: [number, number][] = [
  [3.319, 42.323], // Cap de Creus
  [3.21, 42.27], // Roses
  [3.18, 42.18],
  [3.12, 42.12], // L'Escala
  [3.21, 42.0], // Begur
  [3.18, 41.92],
  [3.09, 41.83], // Palamós
  [3.03, 41.78], // Sant Feliu de Guíxols
  [2.92, 41.72], // Tossa
  [2.85, 41.69], // Lloret de Mar
  [2.79, 41.67], // Blanes
  [2.65, 41.63],
  [2.45, 41.55],
  [2.3, 41.48],
  [2.2, 41.42], // Barcelona
  [2.12, 41.36],
  [2.0, 41.3], // El Prat
  [1.85, 41.23],
  [1.65, 41.13],
  [1.25, 41.12], // Tarragona
];

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

    return {
      worldCountries,
      spainProvinces,
      cataloniaProvinces,
      costaBravaCoast: COSTA_BRAVA_COAST,
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
