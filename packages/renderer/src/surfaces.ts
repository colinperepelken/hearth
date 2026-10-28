import * as THREE from 'three';
import type { ApplianceFinishId, CountertopId, FlooringId, WoodSpeciesId } from '@hearth/core';
import { quartz, type SurfaceTextures } from './textures';
import { BUTCHER_LAYOUT, FLOOR_LAYOUT, woodTextures } from './wood';

/** Floor, countertop and appliance materials for the finish ids in @hearth/core. */

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void, seed: number, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

interface StoneLook {
  base: string;
  speckle: [number, number, number, number]; // grey level, spread, alpha, count
  veins: { count: number; soft: string; sharp: string; width: number; length: number };
}

function stone(look: StoneLook, seed: number): SurfaceTextures {
  const map = canvasTexture(
    2048,
    (ctx, rand) => {
      const size = 2048;
      ctx.fillStyle = look.base;
      ctx.fillRect(0, 0, size, size);
      const [g, spread, alpha, count] = look.speckle;
      for (let i = 0; i < count; i++) {
        const v = g + (rand() - 0.5) * spread;
        ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
        const r = 1 + rand() * 2;
        ctx.fillRect(rand() * size, rand() * size, r, r);
      }
      for (let pass = 0; pass < 2; pass++) {
        ctx.filter = pass === 0 ? 'blur(7px)' : 'blur(0.8px)';
        const vr = rng(seed + 1);
        for (let v = 0; v < look.veins.count; v++) {
          let x = vr() * size, y = vr() * size, a = vr() * Math.PI * 2;
          ctx.strokeStyle = pass === 0 ? look.veins.soft : look.veins.sharp;
          ctx.lineWidth = (pass === 0 ? 10 : 1.2) * look.veins.width * (0.5 + vr());
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let s = 0; s < look.veins.length; s++) {
            a += (vr() - 0.5) * 0.35;
            x += Math.cos(a) * 9;
            y += Math.sin(a) * 9;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.filter = 'none';
    },
    seed,
  );
  return { map, worldSize: 1.6 };
}

function mottled(base: [number, number, number], seed: number): SurfaceTextures {
  const map = canvasTexture(
    1024,
    (ctx, rand) => {
      ctx.fillStyle = `rgb(${base.join(',')})`;
      ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 900; i++) {
        const k = (rand() - 0.5) * 30;
        const r = 20 + rand() * 120;
        const x = rand() * 1024, y = rand() * 1024;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${base.map((c) => c + k).join(',')},0.25)`);
        g.addColorStop(1, `rgba(${base.map((c) => c + k).join(',')},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(60,60,60,${rand() * 0.25})`;
        ctx.fillRect(rand() * 1024, rand() * 1024, 1.5, 1.5);
      }
    },
    seed,
  );
  return { map, worldSize: 1.2 };
}

const counterCache = new Map<CountertopId, { tex: SurfaceTextures; params: THREE.MeshPhysicalMaterialParameters; rotate?: boolean }>();

/** Texture set and material parameters for a countertop; callers tile it to the slab size. */
export function countertopLook(id: CountertopId) {
  let v = counterCache.get(id);
  if (v) return v;
  const polished = { roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.08 };
  switch (id) {
    case 'quartz-white':
      v = { tex: quartz(), params: polished };
      break;
    case 'calacatta':
      v = {
        tex: stone({ base: '#f4f1ea', speckle: [225, 30, 0.25, 20000], veins: { count: 6, soft: 'rgba(150,130,100,0.18)', sharp: 'rgba(120,105,85,0.55)', width: 2.2, length: 320 } }, 51),
        params: polished,
      };
      break;
    case 'carrara':
      v = {
        tex: stone({ base: '#e8e8e5', speckle: [210, 40, 0.3, 30000], veins: { count: 22, soft: 'rgba(120,122,128,0.14)', sharp: 'rgba(110,112,118,0.35)', width: 0.8, length: 220 } }, 61),
        params: { roughness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.15 },
      };
      break;
    case 'black-granite':
      v = { tex: stone({ base: '#18181a', speckle: [70, 60, 0.6, 90000], veins: { count: 0, soft: '', sharp: '', width: 0, length: 0 } }, 71), params: polished };
      break;
    case 'soapstone':
      v = {
        tex: stone({ base: '#4a4f4f', speckle: [85, 20, 0.4, 20000], veins: { count: 10, soft: 'rgba(160,170,168,0.08)', sharp: 'rgba(170,178,176,0.3)', width: 0.7, length: 200 } }, 81),
        params: { roughness: 0.55 },
      };
      break;
    case 'concrete':
      v = { tex: mottled([168, 164, 156], 91), params: { roughness: 0.65 } };
      break;
    case 'butcher-maple':
    case 'butcher-walnut': {
      const species: WoodSpeciesId = id === 'butcher-maple' ? 'maple' : 'walnut';
      const t = woodTextures(species, 'natural', BUTCHER_LAYOUT);
      v = { tex: { map: t.map, bumpMap: t.bumpMap, worldSize: BUTCHER_LAYOUT.tile }, params: { roughness: 0.5, bumpScale: 0.3 }, rotate: true };
      break;
    }
  }
  counterCache.set(id, v);
  return v;
}

function tileFloor(kind: 'porcelain-light' | 'porcelain-grey' | 'checker' | 'terracotta'): SurfaceTextures {
  const size = 1024;
  const spec = {
    'porcelain-light': { tiles: 2, colors: ['#e4e1da'], grout: '#c9c5bc', vary: 6, world: 1.2192 },
    'porcelain-grey': { tiles: 2, colors: ['#9d9a94'], grout: '#8a8781', vary: 10, world: 1.2192 },
    checker: { tiles: 4, colors: ['#f1efe9', '#1e1e1e'], grout: '#bdbab3', vary: 4, world: 1.2192 },
    terracotta: { tiles: 4, colors: ['#b8603e'], grout: '#cfc3b2', vary: 26, world: 1.2192 },
  }[kind];
  const map = canvasTexture(
    size,
    (ctx, rand) => {
      const t = size / spec.tiles, grout = 5;
      ctx.fillStyle = spec.grout;
      ctx.fillRect(0, 0, size, size);
      for (let r = 0; r < spec.tiles; r++) {
        for (let c = 0; c < spec.tiles; c++) {
          const base = spec.colors[(r + c) % spec.colors.length]!;
          ctx.fillStyle = base;
          ctx.fillRect(c * t + grout / 2, r * t + grout / 2, t - grout, t - grout);
          const k = (rand() - 0.5) * spec.vary;
          ctx.fillStyle = k > 0 ? `rgba(255,255,255,${k / 100})` : `rgba(0,0,0,${-k / 100})`;
          ctx.fillRect(c * t + grout / 2, r * t + grout / 2, t - grout, t - grout);
          // Faint surface texture.
          for (let i = 0; i < 1500; i++) {
            ctx.fillStyle = `rgba(0,0,0,${rand() * 0.05})`;
            ctx.fillRect(c * t + rand() * t, r * t + rand() * t, 2, 2);
          }
        }
      }
    },
    kind.length,
  );
  const bumpMap = canvasTexture(
    size,
    (ctx) => {
      const t = size / spec.tiles, grout = 5;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#fff';
      for (let r = 0; r < spec.tiles; r++) for (let c = 0; c < spec.tiles; c++) ctx.fillRect(c * t + grout / 2, r * t + grout / 2, t - grout, t - grout);
    },
    1,
    false,
  );
  return { map, bumpMap, worldSize: spec.world };
}

const floorCache = new Map<FlooringId, THREE.MeshPhysicalMaterial>();

/** Floor material whose textures repeat per metre of the floor's UVs (ShapeGeometry UVs are in metres). */
export function floorMaterial(id: FlooringId): THREE.MeshPhysicalMaterial {
  let mat = floorCache.get(id);
  if (mat) return mat;
  const [kind, a, b] = id.split(':') as [string, string, string?];
  let tex: SurfaceTextures;
  let params: THREE.MeshPhysicalMaterialParameters;
  if (kind === 'wood') {
    const t = woodTextures(a as WoodSpeciesId, b ?? 'natural', FLOOR_LAYOUT);
    tex = { map: t.map, bumpMap: t.bumpMap, worldSize: FLOOR_LAYOUT.tile };
    params = { roughness: 0.48, bumpScale: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.25 };
  } else {
    tex = tileFloor(a as Parameters<typeof tileFloor>[0]);
    params = { roughness: a === 'terracotta' ? 0.7 : 0.3, bumpScale: 1.5 };
  }
  const clone = (t?: THREE.Texture) => {
    if (!t) return undefined;
    const c = t.clone();
    c.repeat.set(1 / tex.worldSize, 1 / tex.worldSize);
    c.needsUpdate = true;
    return c;
  };
  mat = new THREE.MeshPhysicalMaterial({ ...params, map: clone(tex.map)!, bumpMap: clone(tex.bumpMap) ?? null });
  floorCache.set(id, mat);
  return mat;
}

/** Swatch preview (data URL) for a floor or countertop texture. */
export function textureSwatch(tex: THREE.Texture, fraction = 0.25): string {
  const src = tex.image as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  c.getContext('2d')!.drawImage(src, 0, 0, src.width * fraction, src.height * fraction, 0, 0, 64, 64);
  return c.toDataURL();
}

export function floorSwatch(id: FlooringId): string {
  return textureSwatch(floorMaterial(id).map!, id.startsWith('wood') ? 0.2 : 0.5);
}

export function countertopSwatch(id: CountertopId): string {
  return textureSwatch(countertopLook(id).tex.map, 0.3);
}

export interface ApplianceMaterials {
  body: THREE.MeshPhysicalMaterial;
  /** Handles stay metal on painted appliances. */
  handle: THREE.MeshPhysicalMaterial;
}

const applianceCache = new Map<ApplianceFinishId, ApplianceMaterials>();

export function applianceMaterials(id: ApplianceFinishId): ApplianceMaterials {
  let v = applianceCache.get(id);
  if (v) return v;
  // Not fully metallic: brushed steel picks up diffuse room light instead of mirroring the floor.
  const steel = new THREE.MeshPhysicalMaterial({ color: '#cfd1d3', metalness: 0.75, roughness: 0.4 });
  switch (id) {
    case 'stainless':
      v = { body: steel, handle: steel };
      break;
    case 'black-stainless': {
      const b = new THREE.MeshPhysicalMaterial({ color: '#45423f', metalness: 0.9, roughness: 0.3 });
      v = { body: b, handle: b };
      break;
    }
    case 'slate': {
      const b = new THREE.MeshPhysicalMaterial({ color: '#6a6763', metalness: 0.7, roughness: 0.4 });
      v = { body: b, handle: steel };
      break;
    }
    case 'white':
      v = { body: new THREE.MeshPhysicalMaterial({ color: '#f2f2f0', roughness: 0.2, clearcoat: 0.6 }), handle: steel };
      break;
    case 'black':
      v = { body: new THREE.MeshPhysicalMaterial({ color: '#161616', roughness: 0.2, clearcoat: 0.6 }), handle: new THREE.MeshPhysicalMaterial({ color: '#222', metalness: 0.8, roughness: 0.3 }) };
      break;
  }
  applianceCache.set(id, v);
  return v;
}
