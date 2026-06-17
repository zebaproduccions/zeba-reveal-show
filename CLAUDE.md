# Motor d'animacions Canvas — multi-tema

## Descripció del projecte

Aplicació web per **crear animacions en Canvas 2D** (1920×1080) i exportar-les a
`.webm` o `.mp4`. Originalment era una sola animació hardcoded (un mapa
Europa → Costa Brava); ara és un **motor genèric independent del tema** + un
**registre d'animacions**, on cada animació és simplement DADES.

Cap animació toca el motor: per fer-ne una de nova es crea un fitxer a
`src/animations/` i es llista al registre. El motor sap reproduir i gravar;
no sap res de mapes ni de cap tema concret.

No hi ha backend, base de dades ni autenticació. Tot és frontend pur.

### Animacions actuals (registrades a `src/animations/index.ts`)

1. **Costa Brava** (`costa-brava.ts`) — mapa amb zoom Europa → Catalunya →
   Costa Brava, traçat de la costa, etiqueta, i pictogrames d'AVE/aeroports.
2. **Intro — Targeta de títol** (`intro-titol.ts`) — animació SENSE mapa, feta
   només amb les capes genèriques de text/formes. Serveix d'exemple de com
   construir un tema nou.

## Stack tècnic

- **Framework**: TanStack Start v1 (full-stack React 19, Vite 7, SSR/SSG)
- **Routing**: file-based a `src/routes/`
- **Canvas**: API nativa `CanvasRenderingContext2D` (no libraries de gràfics)
- **Dades geogràfiques** (només per a animacions de mapa): `d3-geo` per
  projeccions, `world-atlas` (TopoJSON) per països, GeoJSON de CDN per províncies
- **Exportació vídeo**: `MediaRecorder` per `.webm`; `mp4-muxer` (WebCodecs) per `.mp4`
- **Estil**: Tailwind CSS v4 (`src/styles.css`), shadcn/ui (no s'usa a la pàgina principal)
- **Runtime**: Cloudflare Workers (edge); **NO** usar `child_process`, `sharp`, `canvas` ni `puppeteer` a server functions
- **Idioma**: Català (UI i text de les animacions)

## Arquitectura

### El motor — `src/lib/engine/`

Codi reutilitzable i agnòstic del tema. **No conté res específic de cap animació.**

- **`types.ts`**: el contracte. Una `Animation` és `{ id, title, width, height,
  duration, startDelay?, background?, setup?, layers: Layer[] }`. Un `Layer` té
  `start?`, `end?`, `easing?` i `draw(rc)`. El `RenderContext` (`rc`) porta
  `ctx`, `t` (ms global, ja descomptat el `startDelay`), `p`/`pRaw` (progrés
  0..1 dins `[start, end]`), `W`, `H`, `state` (memòria compartida entre capes
  del mateix frame) i `anim`.
- **`easing.ts`**: `easeInOut`, `easeOut`, `easeOutExpo`, `clamp`, `lerp`, `linear`.
- **`timeline.ts`**: `sampleKeyframes` / `sampleNumber` — interpolació per
  keyframes (l'easing s'aplica al keyframe que s'aproxima).
- **`renderer.ts`**: `drawFrame(ctx, anim, tRaw, W, H)` — pinta el fons i
  recorre les capes. Cada capa es dibuixa dins un `ctx.save()/restore()`.
- **`recorder.ts`**: `recordAnimation(anim, onProgress?, format)` — grava
  frame a frame a 2× la mida de l'animació. WebM via `MediaRecorder`; MP4 via
  WebCodecs + `mp4-muxer`.
- **`layers/`**: capes reutilitzables:
  - **`map.ts`**: `createCamera(bboxKeyframes, padKeyframes)` — la càmera de
    mapa (zoom interpolant el **bounding box geogràfic**, no els píxels). Les
    capes de mapa publiquen la projecció a `state` (`PROJECTION_KEY`,
    `SCALE_KEY`) perquè les capes superposades s'hi posicionin.
  - **`text.ts`**: `text({...})` — text multilínia amb entrada fade + rise.
  - **`shape.ts`**: `circle`, `bar`, `line` — formes amb entrada.
  - Convenció: posicions **normalitzades** (0..1) i mides en **fracció
    d'alçada**, perquè es vegin igual a pantalla i en gravació 2×.

### Les animacions — `src/animations/`

Cada fitxer exporta una `Animation` (dades). `index.ts` és el **registre**
(`ANIMATIONS`, `DEFAULT_ANIMATION`, `getAnimation`).

- **`costa-brava.ts`**: tota la lògica específica del mapa de la Costa Brava
  (paleta, timeline `T`, `SCENE_BBOX`, la `camera` per keyframes, `SEA_MASK`,
  `drawPicto`, i les capes: basemap, highlight, traçat de costa, etiqueta,
  ciutats, pictogrames). El basemap és una capa `custom` que consumeix
  `createCamera` i publica la projecció a `state`.
- **`intro-titol.ts`**: exemple sense mapa, compost amb `text`/`bar`/`line`/`circle`.

### Dades geogràfiques — `src/lib/geo-data.ts`

Només per a animacions de mapa. `loadGeo()` carrega `world-atlas/countries-50m`
i les províncies espanyoles (CDN); `extractCostaBrava()` extreu la costa de
Girona entre `COSTA_BRAVA_START` (Blanes) i `COSTA_BRAVA_END` (Portbou).
Coordenades hardcoded (ciutats, aeroports, AVE) viuen aquí.

### Pàgina — `src/routes/index.tsx`

Canvas escalable + bucle `requestAnimationFrame` que crida `drawFrame()`.
Selector de capçalera (apareix amb ≥2 animacions) per triar quina reproduir.
Botons: "Repetir", "Descarregar .webm", "Descarregar .mp4". En seleccionar una
animació, executa el seu `setup()`, recarrega dades i reinicia la reproducció.

### Altres

- **`src/routes/__root.tsx`**: shell HTML amb `<Outlet />`.
- **`src/router.tsx`**: bootstrap de TanStack Router. No modificar l'estructura bàsica.

## Com afegir una animació nova

1. Crea `src/animations/<tema>.ts` que exporti una `Animation`.
2. Compon-la amb capes reutilitzables (`text`, `circle`, `bar`, `line`, càmera
   de mapa…) o, per a coses molt específiques, amb capes `custom` que defineixin
   el seu propi `draw(rc)`.
3. Afegeix-la a `ANIMATIONS` a `src/animations/index.ts`.
4. El motor i el selector de la UI la recullen automàticament.

## Conceptes específics de la Costa Brava (a `costa-brava.ts`)

### Càmera

Projecció `geoMercator`. Zoom interpolant el **bbox geogràfic** (moviment
rectilini sobre la Terra), expressat com a keyframes de bbox + padding:

1. `[-11, 36]` → `[12, 52]` (Europa occidental)
2. `[-2, 39.8]` → `[5, 43.4]` (Catalunya)
3. `[1.5, 41.1]` → `[3.6, 42.5]` (Costa Brava)

### Sea mask

`world-atlas/countries-50m` dibuixa terra més enllà de la costa real. `SEA_MASK`
és un polígon que es pinta **després** dels països i **abans** de les províncies
d'Espanya, amb el mateix gradient de fons (per tant invisible). El punt oest
(`[3.171, 42.432]`) ha de coincidir amb `COSTA_BRAVA_END` (Portbou) perquè no
tapi terra francesa ni deixi forats. **Molt sensible** — verificar visualment
qualsevol canvi a la frontera amb França.

### Pictogrames i etiquetes

- 4 pictogrames a partir de `T.picto_start`; radi proporcional a l'escala.
- **Separació**: els centres es desplacen perquè gairebé es toquin sense
  solapar-se (distància `2r + r*0.08`). No tornar a la separació gran.
- L'avió està rotat `(5 * Math.PI) / 6` (enlairant-se, no aterrant).
- **Etiquetes d'aeroports**: dues línies ("Airport" + nom).
- **Posició**: Girona AVE i Aeroport Girona a l'esquerra; Barcelona AVE i
  Aeroport Barcelona a la dreta.
- Centres i colors són hardcoded a `geo-data.ts`; modificar-los només si
  l'usuari ho demana marcant-los sobre un fotograma.

### Paleta

Crema (`#f3ecdf`, `#ece1c8`, `#dccdaa`), blau (`#0e3d8f`, `#1f64c0`), marró suau.

## Com executar

```bash
bun install
bun run dev
```

El preview corre a `http://localhost:8080` (o el port que indiqui Vite).

## Regles importants per a modificacions

- **No posar res específic d'una animació dins `src/lib/engine/`.** El motor és
  agnòstic; el que sigui d'un tema va al seu fitxer a `src/animations/`.
- **No usar colors hardcoded a components React** (`text-white`, `bg-black`).
  Usar els tokens del tema a `src/styles.css`. (Dins el dibuix de Canvas els
  colors sí que es defineixen al fitxer de l'animació.)
- **No crear `src/pages/`**. TanStack Start usa `src/routes/`.
- **No modificar `src/routeTree.gen.ts`**. Es regenera automàticament.
- La **frontera amb França** (`SEA_MASK`) és molt sensible: verificar
  visualment que no cobreixi terra francesa ni deixi forats.

## Preferència de comunicació

- **Respon sempre en català.**
- Prefereix contingut estàtic hardcoded abans que mock data dinàmica.
- Respostes concises: poques línies de text; codi i tool calls no compten.
