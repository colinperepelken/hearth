import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  doorOptions,
  dot,
  isConvexCorner,
  roomVertices,
  sub,
  toMetres as m,
  wallDir,
  wallInwardNormal,
  wallLength,
  windowOptions,
  type FlooringId,
  type Opening,
  type Room,
  type Vec2,
} from '@hearth/core';
import { floorMaterial } from './surfaces';
import { windowBackdrop } from './textures';
import { woodTextures } from './wood';

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

const glassMaterial = new THREE.MeshPhysicalMaterial({ color: '#dfe9ee', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false });
const leverMaterial = new THREE.MeshPhysicalMaterial({ color: '#c9c9c6', metalness: 1, roughness: 0.25 });
const railMaterial = new THREE.MeshPhysicalMaterial({ color: '#1c1c1c', metalness: 0.6, roughness: 0.5 });
let barnMat: THREE.MeshPhysicalMaterial | null = null;
/** Stained oak for barn doors, so they read against painted walls. */
const barnWood = () => {
  if (!barnMat) {
    const t = woodTextures('white-oak', 'provincial');
    barnMat = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bumpMap, bumpScale: 0.4, roughness: 0.55 });
  }
  return barnMat;
};
const frameMaterials = new Map<string, THREE.MeshPhysicalMaterial>();
const frameMaterial = (hex: string) => {
  let mat = frameMaterials.get(hex);
  if (!mat) frameMaterials.set(hex, (mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.4 })));
  return mat;
};

type R = [number, number, number, number]; // x0, y0, x1, y1

function Slab({ r, z, depth, mat, cast = true }: { r: R; z: number; depth: number; mat: THREE.Material; cast?: boolean }) {
  const [x0, y0, x1, y1] = r;
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, z]} material={mat} castShadow={cast} receiveShadow>
      <boxGeometry args={[x1 - x0, y1 - y0, depth]} />
    </mesh>
  );
}

/** Two-panel shaker door leaf in [x0, x1] x [0, h], centred at depth z, handle on `handleSide`. */
function DoorLeaf({ x0, x1, h, z, handleSide, mat = trimMaterial }: { x0: number; x1: number; h: number; z: number; handleSide: 'start' | 'end'; mat?: THREE.Material }) {
  const T = 0.035, stile = 0.11, rail = 0.11, bottom = 0.2, mid = h * 0.42;
  const frame: R[] = [
    [x0, 0, x0 + stile, h],
    [x1 - stile, 0, x1, h],
    [x0 + stile, h - rail, x1 - stile, h],
    [x0 + stile, 0, x1 - stile, bottom],
    [x0 + stile, mid, x1 - stile, mid + rail],
  ];
  const hx = handleSide === 'end' ? x1 - 0.065 : x0 + 0.065;
  return (
    <group>
      {frame.map((r, i) => (
        <Slab key={i} r={r} z={z} depth={T} mat={mat} />
      ))}
      <Slab r={[x0 + stile, bottom, x1 - stile, h - rail]} z={z} depth={T - 0.012} mat={mat} />
      {[1, -1].map((side) => (
        <group key={side} position={[hx, 0.91, z + side * (T / 2)]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.01]} material={leverMaterial} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 24]} />
          </mesh>
          <mesh position={[handleSide === 'end' ? -0.05 : 0.05, 0, side * 0.055]} rotation={[0, 0, Math.PI / 2]} material={leverMaterial} castShadow>
            <cylinderGeometry args={[0.009, 0.009, 0.11, 12]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.035]} material={leverMaterial}>
            <cylinderGeometry args={[0.009, 0.009, 0.045, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Door({ o, x0, x1, top, t }: { o: Opening; x0: number; x1: number; top: number; t: number }) {
  const d = doorOptions(o);
  const h = top - 0.004;
  const z = -t / 2;
  switch (d.style) {
    case 'single':
      return <DoorLeaf x0={x0 + 0.003} x1={x1 - 0.003} h={h} z={z} handleSide={d.hinge === 'start' ? 'end' : 'start'} />;
    case 'double': {
      const mid = (x0 + x1) / 2;
      return (
        <>
          <DoorLeaf x0={x0 + 0.003} x1={mid - 0.002} h={h} z={z} handleSide="end" />
          <DoorLeaf x0={mid + 0.002} x1={x1 - 0.003} h={h} z={z} handleSide="start" />
        </>
      );
    }
    case 'barn': {
      // Surface-mounted slab on a rail, hung on the room side and covering the opening.
      const over = 0.05, zf = 0.045;
      return (
        <group>
          <Slab r={[x0 - over - 0.25, top + 0.06, x1 + over + 0.25, top + 0.1]} z={0.012} depth={0.02} mat={railMaterial} />
          <DoorLeaf x0={x0 - over} x1={x1 + over} h={top + 0.05} z={zf} handleSide={d.hinge === 'start' ? 'end' : 'start'} mat={barnWood()} />
        </group>
      );
    }
    case 'pocket':
      return null; // slides into the wall: shown open
  }
}

function WindowUnit({ o, x0, x1, sill, top, t }: { o: Opening; x0: number; x1: number; sill: number; top: number; t: number }) {
  const w = windowOptions(o);
  const mat = frameMaterial(w.frame);
  const f = 0.045, sash = 0.035, depth = 0.09;
  const z = -t * 0.55;
  const members: { r: R; z: number }[] = [
    { r: [x0, sill, x0 + f, top], z },
    { r: [x1 - f, sill, x1, top], z },
    { r: [x0 + f, top - f, x1 - f, top], z },
    { r: [x0 + f, sill, x1 - f, sill + f], z },
  ];
  const gx0 = x0 + f, gx1 = x1 - f, gy0 = sill + f, gy1 = top - f;
  const midY = (gy0 + gy1) / 2, midX = (gx0 + gx1) / 2;
  // Sash rectangles, each with its own depth (hung sashes sit in separate tracks).
  let sashes: { r: R; z: number }[] = [{ r: [gx0, gy0, gx1, gy1], z }];
  let framed = true;
  switch (w.style) {
    case 'double-hung':
    case 'single-hung':
      sashes = [
        { r: [gx0, midY - 0.01, gx1, gy1], z: z - 0.02 },
        { r: [gx0, gy0, gx1, midY + 0.01], z: z + 0.02 },
      ];
      break;
    case 'slider':
      sashes = [
        { r: [gx0, gy0, midX + 0.01, gy1], z: z + 0.02 },
        { r: [midX - 0.01, gy0, gx1, gy1], z: z - 0.02 },
      ];
      break;
    case 'casement':
      if (gx1 - gx0 > 0.8) {
        members.push({ r: [midX - 0.025, gy0, midX + 0.025, gy1], z });
        sashes = [
          { r: [gx0, gy0, midX - 0.025, gy1], z },
          { r: [midX + 0.025, gy0, gx1, gy1], z },
        ];
      }
      break;
    case 'awning': {
      const split = gy0 + (gy1 - gy0) * 0.33;
      members.push({ r: [gx0, split - 0.025, gx1, split + 0.025], z });
      sashes = [
        { r: [gx0, split + 0.025, gx1, gy1], z },
        { r: [gx0, gy0, gx1, split - 0.025], z },
      ];
      break;
    }
    case 'picture':
      framed = false;
      break;
  }
  // The upper picture pane of an awning unit is fixed (no sash frame).
  const fixed = (i: number) => !framed || (w.style === 'awning' && i === 0) || (w.style === 'single-hung' && i === 0);

  const bars: R[] = [];
  sashes.forEach(({ r }, i) => {
    const inset = fixed(i) ? 0 : sash;
    const [a, b, c, d] = [r[0] + inset, r[1] + inset, r[2] - inset, r[3] - inset];
    const bw = 0.016;
    if (w.grille === 'colonial') {
      const cols = Math.max(1, Math.round((c - a) / 0.28)), rows = Math.max(1, Math.round((d - b) / 0.3));
      for (let k = 1; k < cols; k++) {
        const x = a + ((c - a) * k) / cols;
        bars.push([x - bw / 2, b, x + bw / 2, d]);
      }
      for (let k = 1; k < rows; k++) {
        const y = b + ((d - b) * k) / rows;
        bars.push([a, y - bw / 2, c, y + bw / 2]);
      }
    } else if (w.grille === 'prairie') {
      const e = 0.09;
      bars.push([a + e - bw / 2, b, a + e + bw / 2, d], [c - e - bw / 2, b, c - e + bw / 2, d], [a, b + e - bw / 2, c, b + e + bw / 2], [a, d - e - bw / 2, c, d - e + bw / 2]);
    }
  });

  return (
    <group>
      {members.map((m, i) => (
        <Slab key={i} r={m.r} z={m.z} depth={depth} mat={mat} />
      ))}
      {sashes.map(({ r, z: sz }, i) => (
        <group key={i}>
          {!fixed(i) &&
            ([
              [r[0], r[1], r[0] + sash, r[3]],
              [r[2] - sash, r[1], r[2], r[3]],
              [r[0] + sash, r[3] - sash, r[2] - sash, r[3]],
              [r[0] + sash, r[1], r[2] - sash, r[1] + sash],
            ] as R[]).map((sr, k) => <Slab key={k} r={sr} z={sz} depth={0.04} mat={mat} />)}
          <mesh position={[(r[0] + r[2]) / 2, (r[1] + r[3]) / 2, sz]} material={glassMaterial}>
            <planeGeometry args={[r[2] - r[0], r[3] - r[1]]} />
          </mesh>
        </group>
      ))}
      {bars.map((b, i) => (
        <Slab key={`g${i}`} r={b} z={z + 0.025} depth={0.01} mat={mat} cast={false} />
      ))}
    </group>
  );
}

function OpeningTrim({ o, thickness }: { o: Opening; thickness: number }) {
  const casing = 0.09, casingT = 0.018;
  const w = m(o.width), sill = m(o.sillHeight), top = m(o.sillHeight + o.height);
  const x0 = m(o.offset), x1 = x0 + w, cx = (x0 + x1) / 2;
  const t = m(thickness);
  const barn = o.kind === 'door' && doorOptions(o).style === 'barn';
  return (
    <group>
      {!barn &&
        [
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
          <Slab r={[x0, sill - 0.024, x1, sill]} z={-t / 2} depth={t} mat={trimMaterial} cast={false} />
          <WindowUnit o={o} x0={x0} x1={x1} sill={sill} top={top} t={t} />
          <mesh position={[cx, (sill + top) / 2, -t - 0.8]} material={backdropMaterial}>
            <planeGeometry args={[w * 4, (top - sill) * 3]} />
          </mesh>
        </>
      )}
      {o.kind === 'door' && <Door o={o} x0={x0} x1={x1} top={top} t={t} />}
      {/* Jamb and head liners so the wall's cut edges read as finished. */}
      {[x0 + 0.01, x1 - 0.01].map((x) => (
        <mesh key={x} position={[x, (sill + top) / 2, -t / 2]} material={trimMaterial} receiveShadow>
          <boxGeometry args={[0.02, top - sill, t]} />
        </mesh>
      ))}
      <Slab r={[x0, top - 0.02, x1, top]} z={-t / 2} depth={t} mat={trimMaterial} cast={false} />
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
