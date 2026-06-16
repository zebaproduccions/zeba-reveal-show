# Mapa Animat — Catalunya / Costa Brava

## Descripció del projecte

Aplicació web que genera una animació en Canvas 2D (1920×1080) d'un mapa des d'Europa occidental fins a la Costa Brava (Catalunya). L'animació inclou:

1. Zoom progressiu: Europa occidental → Catalunya → Costa Brava
2. Traçat de la línia de la Costa Brava sobre el mapa
3. Etiqueta "Costa Brava" amb tipografia geomètrica (estil Gentona)
4. Pictogrames d'AVE (tren) i aeroports (avió) que apareixen amb animació
5. Etiquetes de text al costat de cada pictograma
6. Exportació de l'animació a `.webm` o `.mp4`

No hi ha backend, base de dades ni autenticació. Tot és frontend pur.

## Stack tècnic

- **Framework**: TanStack Start v1 (full-stack React 19, Vite 7, SSR/SSG)
- **Routing**: file-based a `src/routes/`
- **Canvas**: API nativa `CanvasRenderingContext2D` (no libraries de gràfics)
- **Dades geogràfiques**: `d3-geo` per projeccions i camins, `world-atlas` (TopoJSON) per països, GeoJSON de CDN per províncies espanyoles
- **Exportació vídeo**: `MediaRecorder` API per `.webm`; `mp4-muxer` per `.mp4`
- **Estil**: Tailwind CSS v4 (`src/styles.css`), shadcn/ui components (no s'utilitzen a la pàgina principal)
- **Runtime**: Cloudflare Workers (edge); **NO** usar `child_process`, `sharp`, `canvas` ni `puppeteer` a server functions
- **Idioma**: Català (tot el text de la UI i l'animació)

## Fitxers clau

### `src/lib/record-animation.ts` — nucli de l'animació

Aquest és el fitxer més important. Conté:

- **`drawFrame(ctx, tRaw, W, H)`**: dibuixa cada fotograma de l'animació.
- **`recordAnimation(onProgress, format)`**: grava l'animació sencera i descarrega el fitxer.
- **Constants de temps (`T`)**: defineixen quan passa cada event de l'animació (zooms, Costa Brava, pictogrames, etc.).
- **`SEA_MASK`**: polígon que cobreix la Mediterrània per sobre-pintar les imperfeccions del dataset `world-atlas` a la costa. **Molt sensible** — els seus límits oest i nord defineixen quina part de França/Portbou queda com a terra. L'últim punt ha de coincidir amb `COSTA_BRAVA_END`.
- **Pictogrames**: funcions `drawPicto()` per dibuixar cercles blancs amb icona de tren o avió.
  - L'avió està rotat `(5 * Math.PI) / 6` perquè sembli que s'enlaira (pujant cap a la dreta).
  - El tren és un rectangle arrodonit amb finestres i rodes.
- **Paleta**: tons crema (`#f3ecdf`, `#ece1c8`, `#dccdaa`), blau fosc (`#0e3d8f`, `#1f64c0`), i marró suau per contorns.

### `src/lib/geo-data.ts` — dades geogràfiques

- **`loadGeo()`**: carrega `world-atlas/countries-50m.json` i el GeoJSON de províncies espanyoles des de CDN.
- **`extractCostaBrava(gironaFeature)`**: extreu la línia de la costa del polígon de la província de Girona, entre `COSTA_BRAVA_START` (Blanes) i `COSTA_BRAVA_END` (Portbou). Tria el camí més curt al voltant del polígon.
- **Coordenades hardcoded**:
  - `COSTA_BRAVA_START = [2.79, 41.67]`
  - `COSTA_BRAVA_END = [3.171, 42.432]`
  - Ciutats: Roses, L'Escala, Begur, Lloret de Mar
  - Aeroports: Girona–Costa Brava Airport `[2.79, 41.88]`, Barcelona–El Prat `[2.12, 41.39]`
  - AVE: Girona `[2.84, 41.93]`, Barcelona `[2.18, 41.46]`

### `src/routes/index.tsx` — pàgina principal

- Renderitza un `<canvas width={1920} height={1080}>` escalable.
- Inicia `requestAnimationFrame` que crida `drawFrame()`.
- Botons: "Repetir", "Descarregar .webm", "Descarregar .mp4".
- Carrega les dades geogràfiques amb `loadGeo()` abans de començar l'animació.

### `src/routes/__root.tsx` — layout arrel

- Proporciona la capça HTML (`<html>`, `<head>`, `<body>`).
- Ha de contenir `<Outlet />` perquè els children es renderitzin.

### `src/router.tsx` — bootstrap del router

- Inicialitza `createRouter` de TanStack Router.
- No modificar la seva estructura bàsica.

## Conceptes específics i decisions de disseny

### Pictogrames i etiquetes

- Els 4 pictogrames es dibuixen en escena 3 (zoom final) a partir de `T.picto_start`.
- El radi base `r` es calcula proporcional a l'escala del mapa.
- **Separació**: els centres es desplacen proporcionalment perquè gairebé es toquin però no es solapin. La distància és `2r + r*0.08`.
- **Colors per centre** (els centres són hardcoded a `geo-data.ts` i marcats per l'usuari):
  - Taronja: AVE Girona
  - Negre: Aeroport Girona
  - Fucsia: AVE Barcelona
  - Vermell: Aeroport Barcelona
- **Etiquetes d'aeroports**: dues línies. La primera diu "Airport", la segona el nom complet (ex: "Girona-Costa Brava").
- **Posició de les etiquetes**:
  - Girona AVE: a l'esquerra del pictograma (`side: "left"`)
  - Aeroport Girona-Costa Brava: a l'esquerra del pictograma (`side: "left"`)
  - Barcelona AVE: a la dreta del pictograma
  - Aeroport Barcelona-El Prat: a la dreta del pictograma

### Projecció i càmera

- Projecció `geoMercator` de d3-geo.
- La càmera fa zoom interpolant el **bounding box geogràfic** (no les coordenades de píxel), perquè el moviment sigui rectilini sobre la Terra.
- Bbox de les 3 escenes:
  1. `[-11, 36]` → `[12, 52]` (Europa occidental)
  2. `[-2, 39.8]` → `[5, 43.4]` (Catalunya)
  3. `[1.5, 41.1]` → `[3.6, 42.5]` (Costa Brava)

### Exportació vídeo

- **WebM**: usa `MediaRecorder` amb `canvas.captureStream()`. Fallback directe.
- **MP4**: usa `MediaRecorder` per obtenir WebM, i després `mp4-muxer` per re-empaquetar a MP4. Si `mp4-muxer` falla, es fa servir el blob WebM.
- La gravació es fa en un canvas offscreen de 1920×1080, frame a frame, fora del DOM.

### Sea mask

- El dataset `world-atlas/countries-50m` dibuixa terra fins més enllà de la costa real espanyola.
- `SEA_MASK` és un polígon que es pinta **després** dels països i **abans** de les províncies d'Espanya, amb el mateix color de fons (gradient crema). Així tapa les imperfeccions però no es veu.
- El punt oest (`[3.171, 42.432]`) ha de coincidir amb `COSTA_BRAVA_END` (Portbou) perquè la màscara no tapi terra francesa ni deixi forats.

## Com executar

```bash
bun install
bun run dev
```

El preview corre a `http://localhost:8080` (o el port que indiqui Vite).

## Regles importants per a modificacions

- **No usar colors hardcoded** a components (`text-white`, `bg-black`, `#...`). Usar els tokens del tema a `src/styles.css`.
- **No crear `src/pages/`**. TanStack Start usa `src/routes/`.
- **No modificar `src/routeTree.gen.ts`**. Es regenera automàticament.
- **Totes les coordenades de pictogrames** (centres, colors, posició d'etiquetes) són hardcoded i han de ser modificades només si l'usuari ho demana explícitament marcant-les sobre un fotograma.
- **La frontera amb França** (part oest del `SEA_MASK`) és molt sensible. Qualsevol canvi ha de ser verificat visualment perquè no cobreixi terra francesa ni deixi forats.

## Preferència de comunicació

- **Respon sempre en català.** L'usuari es comunica en català i espera respostes en català.
- Prefereix contingut estàtic hardcoded (a fitxers de traducció o components) abans que placeholders dinàmics o mock data en runtime.
- Respostes concises: poques línies de text, codi i tool calls no compten.
