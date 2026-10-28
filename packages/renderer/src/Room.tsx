import { useMemo } from 'react';
import * as THREE from 'three';
import { tiled, windowBackdrop, woodFloor } from './textures';

export interface WindowSpec {
  /** Centre along the back wall, metres from the left wall. */
  centerX: number;
  width: number;
  sill: number;
  height: number;
}

const WALL_T = 0.15;

/**
 * A rectangular room in metres: x 0..width, z 0..depth, back wall at z = 0.
 * Side and front walls are single-sided so the orbit camera can see in from outside.
 */
export function RoomShell({
  width,
  depth,
  height,
  window: win,
  wallColor,
}: {
  width: number;
  depth: number;
  height: number;
  window: WindowSpec;
  wallColor: string;
}) {
  const wall = useMemo(
    () => new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92, side: THREE.FrontSide, shadowSide: THREE.DoubleSide }),
    [wallColor],
  );
  const ceiling = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.95 }), []);
  const trim = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f4f3ee', roughness: 0.35, clearcoat: 0.3 }), []);
  const floor = useMemo(() => {
    const t = tiled(woodFloor(), width, depth);
    return new THREE.MeshPhysicalMaterial({ ...t, bumpScale: 0.6, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.25 });
  }, [width, depth]);
  // Emissive so the path tracer treats the view outside as a light source.
  const backdrop = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: windowBackdrop(), emissiveIntensity: 2.2 }),
    [],
  );

  const wl = win.centerX - win.width / 2, wr = win.centerX + win.width / 2;
  const wTop = win.sill + win.height;
  // Back wall split around the window: [x, y, w, h].
  const backPieces: [number, number, number, number][] = [
    [wl / 2, height / 2, wl, height],
    [(wr + width) / 2, height / 2, width - wr, height],
    [win.centerX, win.sill / 2, win.width, win.sill],
    [win.centerX, (wTop + height) / 2, win.width, height - wTop],
  ];
  const casing = 0.09, casingT = 0.018;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]} material={floor} receiveShadow>
        <planeGeometry args={[width, depth]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[width / 2, height, depth / 2]} material={ceiling} receiveShadow castShadow>
        <planeGeometry args={[width, depth]} />
      </mesh>

      {backPieces.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, -WALL_T / 2]} material={wall} castShadow receiveShadow>
          <boxGeometry args={[w, h, WALL_T]} />
        </mesh>
      ))}
      {/* Left, right, front walls face inward. */}
      <mesh position={[0, height / 2, depth / 2]} rotation={[0, Math.PI / 2, 0]} material={wall} castShadow receiveShadow>
        <planeGeometry args={[depth, height]} />
      </mesh>
      <mesh position={[width, height / 2, depth / 2]} rotation={[0, -Math.PI / 2, 0]} material={wall} castShadow receiveShadow>
        <planeGeometry args={[depth, height]} />
      </mesh>
      <mesh position={[width / 2, height / 2, depth]} rotation={[0, Math.PI, 0]} material={wall} castShadow receiveShadow>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* Window: casing, sill, mullion, view outside. */}
      <group>
        {[
          [wl - casing / 2, (win.sill + wTop) / 2, casing, win.height + casing * 2],
          [wr + casing / 2, (win.sill + wTop) / 2, casing, win.height + casing * 2],
          [win.centerX, wTop + casing / 2, win.width, casing],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x!, y!, casingT / 2]} material={trim} castShadow receiveShadow>
            <boxGeometry args={[w!, h!, casingT]} />
          </mesh>
        ))}
        <mesh position={[win.centerX, win.sill - 0.012, 0.02]} material={trim} castShadow receiveShadow>
          <boxGeometry args={[win.width + 0.04, 0.024, 0.06 + WALL_T]} />
        </mesh>
        <mesh position={[win.centerX, (win.sill + wTop) / 2, -WALL_T / 2]} material={trim} castShadow>
          <boxGeometry args={[0.03, win.height, 0.04]} />
        </mesh>
        <mesh position={[win.centerX, win.sill + win.height / 2, -WALL_T * 6]} material={backdrop}>
          <planeGeometry args={[win.width * 4, win.height * 3]} />
        </mesh>
      </group>
    </group>
  );
}
