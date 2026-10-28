import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  dot,
  isConvexCorner,
  roomVertices,
  sub,
  toMetres as m,
  wallDir,
  wallInwardNormal,
  wallLength,
  type FlooringId,
  type Opening,
  type Room,
  type Vec2,
} from '@hearth/core';
import { floorMaterial } from './surfaces';
import { windowBackdrop } from './textures';

/** Scene position for a plan point at height y (metres). */
export const planToScene = (p: Vec2, y = 0): [number, number, number] => [m(p.x), y, m(p.y)];

const trimMaterial = new THREE.MeshPhysicalMaterial({ color: '#f4f3ee', roughness: 0.35 });
const backdropMaterial = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: windowBackdrop(), emissiveIntensity: 2.2 });

interface Piece {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Splits a wall face into solid pieces around its openings (all mm, wall-local). */
function wallPieces(length: number, height: number, extStart: number, extEnd: number, openings: Opening[]): Piece[] {
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const pieces: Piece[] = [];
  let u = -extStart;
  for (const o of sorted) {
    if (o.offset > u) pieces.push({ u0: u, u1: o.offset, v0: 0, v1: height });
    if (o.sillHeight > 0) pieces.push({ u0: o.offset, u1: o.offset + o.width, v0: 0, v1: o.sillHeight });
    const top = Math.min(height, o.sillHeight + o.height);
    if (top < height) pieces.push({ u0: o.offset, u1: o.offset + o.width, v0: top, v1: height });
    u = Math.max(u, o.offset + o.width);
  }
  if (u < length + extEnd) pieces.push({ u0: u, u1: length + extEnd, v0: 0, v1: height });
  return pieces;
}

function OpeningTrim({ o, thickness }: { o: Opening; thickness: number }) {
  const casing = 0.09, casingT = 0.018;
  const w = m(o.width), sill = m(o.sillHeight), top = m(o.sillHeight + o.height);
  const x0 = m(o.offset), x1 = x0 + w, cx = (x0 + x1) / 2;
  const t = m(thickness);
  return (
    <group>
      {[
        [x0 - casing / 2, (sill + top + casing) / 2, casing, top - sill + casing],
        [x1 + casing / 2, (sill + top + casing) / 2, casing, top - sill + casing],
        [cx, top + casing / 2, w + casing * 2, casing],
      ].map(([x, y, cw, ch], i) => (
        <mesh key={i} position={[x!, y!, casingT / 2]} material={trimMaterial} castShadow receiveShadow>
          <boxGeometry args={[cw!, ch!, casingT]} />
        </mesh>
      ))}
      {o.kind === 'window' && (
        <>
          {/* Flush stool (no ledge) so faucets can sit close to the window. */}
          <mesh position={[cx, sill - 0.012, -t / 2]} material={trimMaterial} receiveShadow>
            <boxGeometry args={[w, 0.024, t]} />
          </mesh>
          <mesh position={[cx, (sill + top) / 2, -t / 2]} material={trimMaterial} castShadow>
            <boxGeometry args={[0.03, top - sill, 0.04]} />
          </mesh>
          <mesh position={[cx, (sill + top) / 2, -t - 0.8]} material={backdropMaterial}>
            <planeGeometry args={[w * 4, (top - sill) * 3]} />
          </mesh>
        </>
      )}
      {/* Jamb liners so the wall's cut edge reads as finished. */}
      {[x0 + 0.01, x1 - 0.01].map((x) => (
        <mesh key={x} position={[x, (sill + top) / 2, -t / 2]} material={trimMaterial} receiveShadow>
          <boxGeometry args={[0.02, top - sill, t]} />
        </mesh>
      ))}
    </group>
  );
}

function WallMesh({ room, index, height, material, cutaway }: { room: Room; index: number; height: number; material: THREE.Material; cutaway: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const wall = room.walls[index]!;
  const n = wallInwardNormal(room, index);
  const d = wallDir(wall);
  const L = wallLength(wall);
  const t = wall.thickness;
  const nWalls = room.walls.length;
  const extStart = isConvexCorner(room, index) ? t : 0;
  const extEnd = isConvexCorner(room, (index + 1) % nWalls) ? t : 0;
  const pieces = useMemo(() => wallPieces(L, height, extStart, extEnd, wall.openings), [L, height, extStart, extEnd, wall.openings]);
  // Local frame: x along the wall, y up, z into the room.
  const angle = -Math.atan2(d.y, d.x);
  const flip = n.x * -d.y + n.y * d.x < 0; // inward normal on local +z?

  useFrame(({ camera }) => {
    if (!ref.current) return;
    if (!cutaway) {
      ref.current.visible = true;
      return;
    }
    // Hide walls the orbit camera is looking through from outside.
    const cam = { x: camera.position.x * 1000, y: camera.position.z * 1000 };
    ref.current.visible = dot(sub(cam, wall.start), n) > -50;
  });

  return (
    <group ref={ref} position={planToScene(wall.start)} rotation={[0, angle, 0]} scale={[1, 1, flip ? -1 : 1]}>
      {pieces.map((p, i) => (
        <mesh key={i} position={[m((p.u0 + p.u1) / 2), m((p.v0 + p.v1) / 2), -m(t) / 2]} material={material} castShadow receiveShadow>
          <boxGeometry args={[m(p.u1 - p.u0), m(p.v1 - p.v0), m(t)]} />
        </mesh>
      ))}
      {wall.openings.map((o) => (
        <OpeningTrim key={o.id} o={o} thickness={t} />
      ))}
    </group>
  );
}

export function RoomModel({
  room,
  height,
  wallPaint,
  floor,
  cutaway,
}: {
  room: Room;
  height: number;
  wallPaint: string;
  floor: FlooringId;
  cutaway: boolean;
}) {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: wallPaint, roughness: 0.92 }), [wallPaint]);
  const verts = roomVertices(room);
  const key = verts.map((v) => `${v.x},${v.y}`).join(';');
  const [floorGeo, ceilGeo] = useMemo(() => {
    const floor = new THREE.Shape(verts.map((v) => new THREE.Vector2(m(v.x), -m(v.y))));
    const ceil = new THREE.Shape(verts.map((v) => new THREE.Vector2(m(v.x), m(v.y))));
    return [new THREE.ShapeGeometry(floor), new THREE.ShapeGeometry(ceil)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const floorMat = floorMaterial(floor);
  const ceilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.95 }), []);
  const ceilRef = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (ceilRef.current) ceilRef.current.visible = !cutaway || camera.position.y < m(height);
  });

  return (
    <group>
      <mesh geometry={floorGeo} rotation={[-Math.PI / 2, 0, 0]} material={floorMat} receiveShadow name="floor" />
      <mesh ref={ceilRef} geometry={ceilGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, m(height), 0]} material={ceilMat} receiveShadow castShadow />
      {room.walls.map((w, i) => (
        <WallMesh key={w.id} room={room} index={i} height={height} material={wallMat} cutaway={cutaway} />
      ))}
    </group>
  );
}
