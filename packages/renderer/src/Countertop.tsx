import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { BacksplashStyleId, CountertopId, SinkOptions } from '@hearth/core';
import { Faucet, SinkBasin } from './Sink';
import { countertopLook } from './surfaces';
import { backsplashTextures, tiled } from './textures';

export interface SinkCutout {
  /** Centre x in metres, measured from the counter's left end. */
  centerX: number;
  width: number;
  depth: number;
  /** Distance from the counter's back edge to the cutout. */
  back: number;
  /** Farmhouse sinks run to the cabinet front: z of the cabinet faces. */
  front: number;
  options: SinkOptions;
}

/**
 * Straight countertop run in metres; origin back-left at the counter's underside, front faces +z.
 * Optionally cut for a sink, which is rendered with its faucet.
 */
export function Countertop({
  length,
  depth,
  thickness,
  sink,
  material = 'quartz-white',
}: {
  length: number;
  depth: number;
  thickness: number;
  sink?: SinkCutout;
  material?: CountertopId;
}) {
  const stone = useMemo(() => {
    const look = countertopLook(material);
    const t = look.rotate ? tiled(look.tex, depth, length, true) : tiled(look.tex, length, depth);
    return new THREE.MeshPhysicalMaterial({ ...look.params, map: t.map, bumpMap: t.bumpMap ?? null });
  }, [length, depth, material]);
  const y = thickness / 2;
  const slab = (key: string, x0: number, x1: number, z0: number, z1: number) => (
    <RoundedBox key={key} args={[x1 - x0, thickness, z1 - z0]} radius={0.004} smoothness={3} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} material={stone} castShadow receiveShadow />
  );

  if (!sink) return <group>{slab('all', 0, length, 0, depth)}</group>;

  const sl = sink.centerX - sink.width / 2, sr = sink.centerX + sink.width / 2;
  const farmhouse = sink.options.style === 'farmhouse';
  const sz0 = sink.back, sz1 = farmhouse ? sink.front : sz0 + sink.depth;

  return (
    <group>
      {slab('l', 0, sl, 0, depth)}
      {slab('r', sr, length, 0, depth)}
      {slab('b', sl, sr, 0, sz0)}
      {!farmhouse && slab('f', sl, sr, sz1, depth)}
      <SinkBasin x0={sl} x1={sr} z0={sz0} z1={sz1} options={sink.options} />
      <Faucet position={[sink.centerX, thickness, Math.max(0.04, sz0 - 0.05)]} style={sink.options.faucet} finish={sink.options.faucetFinish} />
    </group>
  );
}

/** Backsplash rectangle on the wall, in metres; origin at bottom-left. */
export function Backsplash({
  x,
  y,
  width,
  height,
  style,
  color,
  countertop,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  style: BacksplashStyleId;
  color: string;
  countertop: CountertopId;
}) {
  const material = useMemo(() => {
    if (style === 'none') return null;
    if (style === 'slab') {
      const look = countertopLook(countertop);
      const t = tiled(look.tex, width, height);
      return new THREE.MeshPhysicalMaterial({ ...look.params, map: t.map, bumpMap: t.bumpMap ?? null });
    }
    const tex = backsplashTextures(style, color);
    const t = tiled(tex, width, height);
    for (const m of [t.map, t.bumpMap, t.roughnessMap]) {
      if (!m) continue;
      m.rotation = tex.rotation;
    }
    return new THREE.MeshPhysicalMaterial({ ...t, bumpScale: 1.5, roughness: 1, clearcoat: 0.8, clearcoatRoughness: 0.05 });
  }, [width, height, style, color, countertop]);
  if (!material) return null;
  return (
    <mesh position={[x + width / 2, y + height / 2, 0.004]} material={material} receiveShadow>
      <boxGeometry args={[width, height, 0.008]} />
    </mesh>
  );
}
