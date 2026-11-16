/**
 * Fundo de satélite do desenho do pivô (MapaPivo): tiles do Esri World Imagery (sem chave,
 * com atribuição) posicionados no MESMO viewBox do SVG, para o círculo do pivô (raio `r`)
 * cair em cima do pivô de verdade. Centro e ponta vêm do GPS da calibração do ângulo.
 * Norte para cima, como o desenho (o ângulo calibrado é azimute).
 */
export interface GeoPivo { centro: { lat: number; lon: number }; ponta: { lat: number; lon: number } }
export interface TileSatelite { url: string; x: number; y: number; size: number }

const R_TERRA = 6378137;
const Z_MAX = 18;   // acima disso a imagem falta em boa parte da zona rural
export const ATRIBUICAO_SATELITE = 'Imagem: Esri, Maxar, Earthstar Geographics';
const URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const rad = (g: number) => (g * Math.PI) / 180;

/** Raio do pivô em metros (centro → ponta, haversine). */
export function raioDoPivoM(g: GeoPivo): number {
  const dLat = rad(g.ponta.lat - g.centro.lat), dLon = rad(g.ponta.lon - g.centro.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(g.centro.lat)) * Math.cos(rad(g.ponta.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TERRA * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Pixel global (Web Mercator, tiles de 256) do ponto no zoom z. */
function pixel(lat: number, lon: number, z: number) {
  const mundo = 256 * 2 ** z;
  const s = Math.sin(rad(Math.max(-85, Math.min(85, lat))));
  return { x: ((lon + 180) / 360) * mundo, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * mundo };
}

/**
 * Tiles que cobrem o viewBox `w`×`h`, com o centro do pivô em (cx, cy) e o raio dele valendo `r`
 * unidades. null = sem geo válido (raio < 20 m ou > 5 km: GPS ruim, não é um pivô).
 */
export function tilesDoPivo(g: GeoPivo | null | undefined, vb = { cx: 179, cy: 150, r: 118, w: 358, h: 300 }): { z: number; tiles: TileSatelite[] } | null {
  if (!g) return null;
  const raio = raioDoPivoM(g);
  if (!(raio >= 20 && raio <= 5000)) return null;
  const cos = Math.cos(rad(g.centro.lat));
  // Menor zoom em que o raio tem ≥ r pixels: a imagem é reduzida (nítida), nunca esticada além do Z_MAX.
  const z = Math.max(1, Math.min(Z_MAX, Math.ceil(Math.log2((vb.r * 2 * Math.PI * R_TERRA * cos) / (256 * raio)))));
  const mpp = (2 * Math.PI * R_TERRA * cos) / (256 * 2 ** z);
  const k = vb.r / (raio / mpp);                       // unidades do viewBox por pixel do tile
  const c = pixel(g.centro.lat, g.centro.lon, z);
  const n = 2 ** z;
  const tx0 = Math.floor((c.x - vb.cx / k) / 256), tx1 = Math.floor((c.x + (vb.w - vb.cx) / k) / 256);
  const ty0 = Math.max(0, Math.floor((c.y - vb.cy / k) / 256)), ty1 = Math.min(n - 1, Math.floor((c.y + (vb.h - vb.cy) / k) / 256));
  const tiles: TileSatelite[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      tiles.push({
        url: URL(z, ((tx % n) + n) % n, ty),
        x: vb.cx + (tx * 256 - c.x) * k,
        y: vb.cy + (ty * 256 - c.y) * k,
        size: 256 * k,
      });
    }
  }
  return { z, tiles };
}
