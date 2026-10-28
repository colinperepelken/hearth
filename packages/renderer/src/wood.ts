import * as THREE from 'three';
import { STAINS, type Stain, type WoodSpeciesId } from '@hearth/core';

/**
 * Procedural, tileable wood grain. Grain runs along the texture's v axis; one tile covers
 * WOOD_TILE metres and is made of four glued boards, each with its own figure and tone.
 */
export const WOOD_TILE = 0.5;
const BOARDS = 4;

interface SpeciesLook {
  early: [number, number, number];
  late: [number, number, number];
  /** Growth rings per metre across the board. */
  rings: number;
  /** How strongly latewood shows against earlywood, 0..1. */
  contrast: number;
  /** Visible pores, 0..1; ring-porous woods concentrate them in earlywood. */
  pores: number;
  ringPorous?: boolean;
  /** Board-to-board colour variation, 0..1. */
  variation: number;
  knots?: boolean;
}

const LOOKS: Record<WoodSpeciesId, SpeciesLook> = {
  maple: { early: [236, 214, 178], late: [212, 180, 136], rings: 330, contrast: 0.35, pores: 0, variation: 0.05 },
  'red-oak': { early: [216, 170, 122], late: [168, 112, 70], rings: 300, contrast: 0.75, pores: 0.9, ringPorous: true, variation: 0.08 },
  'white-oak': { early: [206, 178, 134], late: [156, 122, 82], rings: 320, contrast: 0.6, pores: 0.8, ringPorous: true, variation: 0.06 },
  walnut: { early: [100, 68, 47], late: [58, 37, 26], rings: 260, contrast: 0.6, pores: 0.5, variation: 0.14 },
  cherry: { early: [196, 128, 88], late: [158, 90, 58], rings: 380, contrast: 0.35, pores: 0.1, variation: 0.08 },
  pine: { early: [238, 208, 152], late: [196, 136, 70], rings: 150, contrast: 0.9, pores: 0, variation: 0.06, knots: true },
  hickory: { early: [228, 198, 154], late: [150, 104, 66], rings: 250, contrast: 0.7, pores: 0.6, ringPorous: true, variation: 0.3 },
  ash: { early: [228, 206, 166], late: [182, 148, 102], rings: 260, contrast: 0.7, pores: 0.8, ringPorous: true, variation: 0.06 },
  birch: { early: [234, 212, 176], late: [212, 180, 136], rings: 420, contrast: 0.3, pores: 0.05, variation: 0.05 },
  alder: { early: [214, 164, 122], late: [184, 128, 90], rings: 300, contrast: 0.35, pores: 0.05, variation: 0.07 },
};

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Value noise that repeats every `px` x `py` cells, so the texture tiles. */
function noise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
  const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed), c = hash(x0, y1, seed), d = hash(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, px: number, py: number, seed: number): number {
  let s = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) {
    s += amp * noise(x * f, y * f, px * f, py * f, seed + o);
    amp *= 0.5;
    f *= 2;
  }
  return s;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function applyStain(rgb: [number, number, number], stain: Stain): [number, number, number] {
  if (stain.mode === 'multiply') {
    return rgb.map((c, i) => c * (1 - stain.strength + (stain.strength * stain.rgb[i]!) / 255)) as [number, number, number];
  }
  if (stain.mode === 'wash') {
    return rgb.map((c, i) => c + (stain.rgb[i]! - c) * stain.strength) as [number, number, number];
  }
  return rgb;
}

/**
 * Paints wood into an ImageData-sized buffer. `extent` (0..1] renders only part of the tile,
 * which keeps grain legible on small swatches.
 */
interface Layout {
  /** Metres covered by one texture tile. */
  tile: number;
  boards: number;
  /** Floor planks: one butt joint per board per tile, at a random position. */
  joints: boolean;
}
const CABINET_LAYOUT: Layout = { tile: WOOD_TILE, boards: BOARDS, joints: false };

function paintWood(size: number, species: WoodSpeciesId, stain: Stain, extent: number, layout: Layout = CABINET_LAYOUT) {
  const look = LOOKS[species];
  const color = new Uint8ClampedArray(size * size * 4);
  const bump = new Uint8ClampedArray(size * size * 4);
  const BOARDS = layout.boards;
  const WOOD_TILE = layout.tile;
  const boardW = WOOD_TILE / BOARDS;
  // Knot centres in tile coordinates (two per tile for pine).
  const knots = look.knots
    ? [0, 1].map((k) => ({ u: 0.15 + hash(k, 7, 3) * 0.7, v: 0.15 + hash(k, 9, 3) * 0.7, r: 0.012 + hash(k, 5, 3) * 0.01 }))
    : [];

  for (let py = 0; py < size; py++) {
    const v = (py / size) * extent;
    for (let px = 0; px < size; px++) {
      const u = (px / size) * extent;
      const board = Math.floor(u * BOARDS);
      const bu = u * BOARDS - board;
      const cx = 0.2 + hash(board, 1, 11) * 0.6;
      const flat = hash(board, 2, 11) > 0.35; // flat-sawn boards show cathedral arches
      const phase = hash(board, 3, 11);
      const tone = 1 + (hash(board, 4, 11) - 0.5) * 2 * look.variation;

      let dx = Math.abs(bu - cx) * boardW;
      // Knots pull the rings around them.
      let knot = 0;
      for (const k of knots) {
        const du = (u - k.u) * WOOD_TILE, dv = (v - k.v) * WOOD_TILE * 0.5;
        const d = Math.hypot(du, dv);
        if (d < k.r * 4) dx += (k.r * 4 - d) * 0.4;
        knot = Math.max(knot, 1 - smooth(k.r * 0.6, k.r, d));
      }
      const arch = flat ? 0.012 * (1 - Math.cos(2 * Math.PI * (v * 2 + phase))) : 0;
      const warp = (fbm(u * 8, v * 2, 8, 2, 21 + board) - 0.5) * 0.01;
      const t = (dx + arch + warp) * look.rings;
      const ring = t - Math.floor(t);
      const late = smooth(0.55, 0.75, ring) * (1 - smooth(0.9, 1, ring));

      const k = late * look.contrast;
      let rgb: [number, number, number] = [0, 1, 2].map(
        (i) => (look.early[i]! + (look.late[i]! - look.early[i]!) * k) * tone,
      ) as [number, number, number];

      // Mottling along the grain.
      const mottle = 1 + (fbm(u * 16, v * 3, 16, 3, 5) - 0.5) * 0.12;
      rgb = rgb.map((c) => c * mottle) as [number, number, number];

      // Pores: short dark streaks along the grain.
      let pore = 0;
      if (look.pores > 0) {
        const n = noise(u * 900, v * 60, 900, 60, 77);
        const where = look.ringPorous ? 1 - late : 0.6;
        pore = smooth(0.78, 0.9, n) * look.pores * where;
        rgb = rgb.map((c) => c * (1 - pore * 0.35)) as [number, number, number];
      }
      if (knot > 0) rgb = rgb.map((c, i) => c + ([70, 40, 20][i]! - c) * knot * 0.85) as [number, number, number];
      // Glue line between boards.
      const seamW = layout.joints ? 0.012 : 0.004;
      let seam = bu < seamW || bu > 1 - seamW ? (layout.joints ? 0.7 : 0.88) : 1;
      if (layout.joints) {
        const jv = hash(board, 6, 13);
        const dv = Math.abs(v - jv);
        if (Math.min(dv, 1 - dv) < 0.0015) seam = 0.7;
      }

      rgb = applyStain(rgb.map((c) => c * seam) as [number, number, number], stain);
      const o = (py * size + px) * 4;
      color[o] = rgb[0];
      color[o + 1] = rgb[1];
      color[o + 2] = rgb[2];
      color[o + 3] = 255;
      const b = 200 - pore * 140 - late * 20 - (seam < 1 ? 60 : 0);
      bump[o] = bump[o + 1] = bump[o + 2] = b;
      bump[o + 3] = 255;
    }
  }
  return { color, bump };
}

function toCanvas(data: Uint8ClampedArray, size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
  return c;
}

function stainById(id: string): Stain {
  return STAINS.find((s) => s.id === id) ?? STAINS[0]!;
}

const textureCache = new Map<string, { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }>();

/** Wide floor planks: 8 boards (~7") across a 1.5 m tile, with butt joints. */
export const FLOOR_LAYOUT: Layout = { tile: 1.5, boards: 8, joints: true };
/** Edge-grain butcher block strips (~1.5"). */
export const BUTCHER_LAYOUT: Layout = { tile: 0.5, boards: 13, joints: false };

export function woodTextures(species: WoodSpeciesId, stainId: string, layout: Layout = CABINET_LAYOUT) {
  const key = `${species}:${stainId}:${layout.tile}:${layout.boards}:${layout.joints}`;
  let t = textureCache.get(key);
  if (!t) {
    const size = layout === CABINET_LAYOUT ? 1024 : 1536;
    const { color, bump } = paintWood(size, species, stainById(stainId), 1, layout);
    const make = (c: HTMLCanvasElement, srgb: boolean) => {
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = 8;
      return tex;
    };
    t = { map: make(toCanvas(color, size), true), bumpMap: make(toCanvas(bump, size), false) };
    textureCache.set(key, t);
  }
  return t;
}

const swatchCache = new Map<string, string>();

/** Small data-URL preview of a species and stain, for the finishes picker. */
export function woodSwatch(species: WoodSpeciesId, stainId: string): string {
  const key = `${species}:${stainId}`;
  let url = swatchCache.get(key);
  if (!url) {
    const size = 64;
    url = toCanvas(paintWood(size, species, stainById(stainId), 0.25).color, size).toDataURL();
    swatchCache.set(key, url);
  }
  return url;
}
