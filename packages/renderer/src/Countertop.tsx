import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { BacksplashStyleId, CountertopId } from '@hearth/core';
import { countertopLook } from './surfaces';
import { backsplashTextures, tiled } from './textures';

export interface SinkCutout {
  /** Centre x in metres, measured from the counter's left end. */
  centerX: number;
  width: number;
  depth: number;
}

/**
 * Straight countertop run in metres; origin back-left at the counter's underside, front faces +z.
 * Optionally cut for an undermount sink, which is rendered with a faucet.
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
  const steel = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#d4d5d6', metalness: 1, roughness: 0.32 }), []);
  const chrome = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#e8e8e8', metalness: 1, roughness: 0.08 }), []);

  const y = thickness / 2;
  const slab = (key: string, x0: number, x1: number, z0: number, z1: number) => (
    <RoundedBox key={key} args={[x1 - x0, thickness, z1 - z0]} radius={0.004} smoothness={3} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} material={stone} castShadow receiveShadow />
  );

  if (!sink) return <group>{slab('all', 0, length, 0, depth)}</group>;

  const sl = sink.centerX - sink.width / 2, sr = sink.centerX + sink.width / 2;
  const sz0 = 0.1, sz1 = sz0 + sink.depth;
  const bowlDepth = 0.23, wall = 0.004;

  return (
    <group>
      {slab('l', 0, sl, 0, depth)}
      {slab('r', sr, length, 0, depth)}
      {slab('b', sl, sr, 0, sz0)}
      {slab('f', sl, sr, sz1, depth)}
      {/* Undermount bowl: open-top box of thin steel sheets. */}
      <group position={[sink.centerX, -bowlDepth / 2, (sz0 + sz1) / 2]}>
        <mesh position={[0, -bowlDepth / 2, 0]} material={steel} receiveShadow>
          <boxGeometry args={[sink.width, wall, sink.depth]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`x${s}`} position={[(s * sink.width) / 2, 0, 0]} material={steel} receiveShadow castShadow>
            <boxGeometry args={[wall, bowlDepth, sink.depth]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`z${s}`} position={[0, 0, (s * sink.depth) / 2]} material={steel} receiveShadow castShadow>
            <boxGeometry args={[sink.width, bowlDepth, wall]} />
          </mesh>
        ))}
        <mesh position={[0, -bowlDepth / 2 + 0.004, 0.03]} rotation={[-Math.PI / 2, 0, 0]} material={chrome}>
          <circleGeometry args={[0.045, 32]} />
        </mesh>
      </group>
      <Faucet position={[sink.centerX, thickness, sz0 / 2]} material={chrome} />
    </group>
  );
}

function Faucet({ position, material }: { position: [number, number, number]; material: THREE.Material }) {
  const neck = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.0, 0),
      new THREE.Vector3(0, 0.25, 0),
      new THREE.Vector3(0, 0.36, 0.06),
      new THREE.Vector3(0, 0.33, 0.2),
      new THREE.Vector3(0, 0.25, 0.22),
    ]);
    return new THREE.TubeGeometry(curve, 64, 0.013, 20, false);
  }, []);
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} material={material} castShadow>
        <cylinderGeometry args={[0.026, 0.03, 0.06, 32]} />
      </mesh>
      <mesh geometry={neck} material={material} castShadow />
      <mesh position={[0, 0.24, 0.22]} material={material} castShadow>
        <cylinderGeometry args={[0.016, 0.014, 0.04, 24]} />
      </mesh>
      <mesh position={[0.045, 0.09, 0]} rotation={[0, 0, -Math.PI / 2.6]} material={material} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.08, 12]} />
      </mesh>
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
