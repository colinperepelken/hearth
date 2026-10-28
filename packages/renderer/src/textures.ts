import * as THREE from 'three';

/**
 * Procedural canvas textures, so the prototype needs no downloaded assets.
 * Each texture covers `worldSize` metres; `tiled()` sets repeat for a given surface size.
 */

export interface SurfaceTextures {
  map: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
  /** Metres covered by one repeat of the texture. */
  worldSize: number;
}

/** Deterministic PRNG so textures don't change between reloads. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement, color: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

const cache = new Map<string, SurfaceTextures>();
function cached(key: string, make: () => SurfaceTextures): SurfaceTextures {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
}

/** Wide-plank white oak, planks running along +y of the texture. */
export function woodFloor(): SurfaceTextures {
  return cached('wood', () => {
    const size = 2048;
    const worldSize = 1.8; // ~ 10 planks of 7"
    const [c, ctx] = canvas(size);
    const [b, bctx] = canvas(size);
    const rand = rng(7);
    const plankW = size / 10;
    bctx.fillStyle = '#888';
    bctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 10; i++) {
      const x0 = i * plankW;
      // Each plank column is split into boards of random length.
      let y = -rand() * size;
      while (y < size) {
        const len = size * (0.45 + rand() * 0.6);
        const tone = 0.85 + rand() * 0.25;
        const r = Math.round(196 * tone), g = Math.round(162 * tone), bl = Math.round(118 * tone);
        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fillRect(x0, y, plankW, len);

        // Grain: long, slightly wavy streaks.
        for (let k = 0; k < 70; k++) {
          const gx = x0 + rand() * plankW;
          const dark = rand() < 0.6;
          ctx.strokeStyle = dark ? `rgba(90,60,30,${0.05 + rand() * 0.12})` : `rgba(255,235,200,${0.04 + rand() * 0.08})`;
          ctx.lineWidth = 0.6 + rand() * 2.2;
          ctx.beginPath();
          const amp = 1 + rand() * 4;
          const freq = 0.002 + rand() * 0.006;
          const ph = rand() * 10;
          for (let yy = y; yy < y + len; yy += 16) {
            const xx = gx + Math.sin(yy * freq + ph) * amp;
            yy === y ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
        // Occasional knot.
        if (rand() < 0.25) {
          const kx = x0 + plankW * (0.2 + rand() * 0.6), ky = y + len * rand();
          const g2 = ctx.createRadialGradient(kx, ky, 0, kx, ky, 10 + rand() * 12);
          g2.addColorStop(0, 'rgba(70,45,20,0.55)');
          g2.addColorStop(1, 'rgba(70,45,20,0)');
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 14, 30, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // End joint.
        ctx.fillStyle = 'rgba(40,25,10,0.6)';
        ctx.fillRect(x0, y, plankW, 2);
        bctx.fillStyle = '#222';
        bctx.fillRect(x0, y, plankW, 3);
        y += len;
      }
      // Long seam between planks.
      ctx.fillStyle = 'rgba(40,25,10,0.55)';
      ctx.fillRect(x0, 0, 2, size);
      bctx.fillStyle = '#222';
      bctx.fillRect(x0, 0, 3, size);
    }
    return { map: toTexture(c, true), bumpMap: toTexture(b, false), worldSize };
  });
}

/** White quartz with soft grey veining. */
export function quartz(): SurfaceTextures {
  return cached('quartz', () => {
    const size = 2048;
    const [c, ctx] = canvas(size);
    const rand = rng(42);
    ctx.fillStyle = '#efede8';
    ctx.fillRect(0, 0, size, size);
    // Fine speckle.
    for (let i = 0; i < 40000; i++) {
      const v = 200 + rand() * 40;
      ctx.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
      ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
    }
    // Veins: random walks drawn soft, then sharp.
    for (let pass = 0; pass < 2; pass++) {
      ctx.filter = pass === 0 ? 'blur(6px)' : 'blur(0.8px)';
      const vr = rng(99);
      for (let v = 0; v < 9; v++) {
        let x = vr() * size, y = vr() * size;
        let a = vr() * Math.PI * 2;
        ctx.strokeStyle = pass === 0 ? `rgba(120,118,112,${0.12 + vr() * 0.1})` : `rgba(110,108,104,${0.25 + vr() * 0.3})`;
        ctx.lineWidth = pass === 0 ? 8 + vr() * 10 : 0.8 + vr() * 1.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 260; s++) {
          a += (vr() - 0.5) * 0.35;
          x += Math.cos(a) * 9;
          y += Math.sin(a) * 9;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.filter = 'none';
    return { map: toTexture(c, true), worldSize: 1.6 };
  });
}

/** 3x6 gloss subway tile, running bond, light grout. */
export function subwayTile(tileColor = '#f3f1ec', groutColor = '#d9d6cf'): SurfaceTextures {
  return cached(`subway:${tileColor}:${groutColor}`, () => {
    const size = 1024;
    const worldSize = 0.6096; // 24": 4 tiles across, 8 rows
    const [c, ctx] = canvas(size);
    const [b, bctx] = canvas(size);
    const [r, rctx] = canvas(size);
    const rand = rng(3);
    const tw = size / 4, th = size / 8, grout = 4;
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#e6e6e6'; // grout is rough
    rctx.fillRect(0, 0, size, size);

    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? tw / 2 : 0;
      for (let col = -1; col < 5; col++) {
        const x = col * tw + off + grout / 2, y = row * th + grout / 2;
        const w = tw - grout, h = th - grout;
        const shade = 0.97 + rand() * 0.05;
        ctx.fillStyle = tileColor;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = `rgba(${shade > 1 ? 255 : 0},${shade > 1 ? 255 : 0},${shade > 1 ? 255 : 0},${Math.abs(1 - shade)})`;
        ctx.fillRect(x, y, w, h);
        // Pillowed edge in the bump map.
        const g = bctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#999');
        g.addColorStop(0.08, '#fff');
        g.addColorStop(0.92, '#fff');
        g.addColorStop(1, '#999');
        bctx.fillStyle = g;
        bctx.fillRect(x, y, w, h);
        rctx.fillStyle = '#262626';
        rctx.fillRect(x, y, w, h);
      }
    }
    return { map: toTexture(c, true), bumpMap: toTexture(b, false), roughnessMap: toTexture(r, false), worldSize };
  });
}

/** Clones the textures with repeat set so `worldSize` maps correctly onto a w x h metre face. */
export function tiled(t: SurfaceTextures, w: number, h: number, rotate = false) {
  const set = (tex: THREE.Texture | undefined) => {
    if (!tex) return undefined;
    const c = tex.clone();
    c.repeat.set(w / t.worldSize, h / t.worldSize);
    if (rotate) c.rotation = Math.PI / 2;
    c.needsUpdate = true;
    return c;
  };
  return { map: set(t.map)!, bumpMap: set(t.bumpMap), roughnessMap: set(t.roughnessMap) };
}

/** Soft sky-and-garden backdrop seen through windows. */
export function windowBackdrop(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#a9c8e8');
  g.addColorStop(0.55, '#e4eef6');
  g.addColorStop(0.62, '#9db38a');
  g.addColorStop(1, '#5e7a4c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const rand = rng(11);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${60 + rand() * 40},${100 + rand() * 50},${50 + rand() * 30},0.5)`;
    ctx.beginPath();
    ctx.arc(rand() * 512, 300 + rand() * 60, 20 + rand() * 40, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, true);
}
