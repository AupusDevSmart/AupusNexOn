import { describe, expect, it } from 'vitest';
import { raioDoPivoM, tilesDoPivo } from './pivoSatelite';

// PIV-01 (Lab): calibração de 12/11
const LAB = { centro: { lat: -14.8393444, lon: -47.7160546 }, ponta: { lat: -14.8419572, lon: -47.7104592 } };

describe('fundo de satélite do pivô', () => {
  it('raio centro → ponta em metros', () => {
    expect(raioDoPivoM(LAB)).toBeGreaterThan(660);
    expect(raioDoPivoM(LAB)).toBeLessThan(680);
  });

  it('tiles cobrem o viewBox inteiro, com o raio do pivô = 118 unidades', () => {
    const r = tilesDoPivo(LAB)!;
    expect(r.z).toBe(15);
    const minX = Math.min(...r.tiles.map((t) => t.x)), minY = Math.min(...r.tiles.map((t) => t.y));
    const maxX = Math.max(...r.tiles.map((t) => t.x + t.size)), maxY = Math.max(...r.tiles.map((t) => t.y + t.size));
    expect(minX).toBeLessThanOrEqual(0); expect(minY).toBeLessThanOrEqual(0);
    expect(maxX).toBeGreaterThanOrEqual(358); expect(maxY).toBeGreaterThanOrEqual(300);
    // reduzida, nunca esticada: tile de 256 px ocupa ≤ 256 unidades
    expect(r.tiles[0].size).toBeLessThanOrEqual(256);
    expect(r.tiles[0].url).toMatch(/World_Imagery\/MapServer\/tile\/15\/\d+\/\d+$/);
  });

  it('sem geo ou GPS absurdo: sem fundo', () => {
    expect(tilesDoPivo(null)).toBeNull();
    expect(tilesDoPivo({ centro: LAB.centro, ponta: LAB.centro })).toBeNull();
    expect(tilesDoPivo({ centro: LAB.centro, ponta: { lat: -10, lon: -47 } })).toBeNull();
  });
});
