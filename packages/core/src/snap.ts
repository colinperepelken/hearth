import { catalogItem, itemSize } from './catalog';
import { add, closestOnSegment, dot, scale, sub, wallDir, wallInwardNormal, wallLength } from './geometry';
import type { PlacedItem, Room, Vec2 } from './model';
import type { Mm } from './units';

/** How close (mm) an edge must be to snap to a neighbour or wall end. */
const SNAP = 100;
/** How far (mm) beyond its depth an item can be from a wall and still be pulled onto it. */
const WALL_REACH = 600;

/** Rotation that makes an item's front face along `n` (plan radians, see PlacedItem.rotation). */
export function rotationFacing(n: Vec2): number {
  return Math.atan2(-n.x, n.y);
}

/** Item-local to plan: local x is width (left to right), local y is depth (back to front). */
export function toPlan(item: PlacedItem, local: Vec2): Vec2 {
  const c = Math.cos(item.rotation), s = Math.sin(item.rotation);
  return { x: item.position.x + local.x * c - local.y * s, y: item.position.y + local.x * s + local.y * c };
}

export function footprint(item: PlacedItem): Vec2[] {
  const { width: w, depth: d } = itemSize(item);
  return [
    { x: -w / 2, y: -d / 2 },
    { x: w / 2, y: -d / 2 },
    { x: w / 2, y: d / 2 },
    { x: -w / 2, y: d / 2 },
  ].map((p) => toPlan(item, p));
}

function verticalOverlap(a: PlacedItem, b: PlacedItem): boolean {
  const ha = itemSize(a).height, hb = itemSize(b).height;
  return a.position.z < b.position.z + hb && b.position.z < a.position.z + ha;
}

export interface SnapResult {
  x: Mm;
  y: Mm;
  rotation: number;
  /** Index of the wall the item was pushed against, if any. */
  wall: number | null;
}

/**
 * Where `item` lands if dropped at plan point `p`: wall-snapping items back onto the nearest wall,
 * facing into the room, then slide along it to line up with neighbours and wall ends.
 */
export function snapItem(room: Room, items: PlacedItem[], item: PlacedItem, p: Vec2): SnapResult {
  const c = catalogItem(item.catalogId);
  const { width: w, depth: d } = itemSize(item);
  const free: SnapResult = { x: p.x, y: p.y, rotation: item.rotation, wall: null };
  if (c.snap === 'free' || !room.walls.length) return free;

  let best: { i: number; distance: number } | null = null;
  room.walls.forEach((wall, i) => {
    const q = closestOnSegment(p, wall.start, wall.end);
    if (!best || q.distance < best.distance) best = { i, distance: q.distance };
  });
  const hit = best as { i: number; distance: number } | null;
  if (!hit || hit.distance > d / 2 + WALL_REACH) return free;

  const wall = room.walls[hit.i]!;
  const dir = wallDir(wall), n = wallInwardNormal(room, hit.i), L = wallLength(wall);
  const rotation = rotationFacing(n);
  const clampS = (s: number) => Math.max(w / 2, Math.min(L - w / 2, s));
  let s = clampS(dot(sub(p, wall.start), dir));

  // Candidate centre positions along the wall: wall ends, then neighbours' edges.
  const candidates: { s: number; priority: number }[] = [
    { s: w / 2, priority: 0 },
    { s: L - w / 2, priority: 0 },
  ];
  for (const o of items) {
    if (o.id === item.id) continue;
    const od = itemSize(o).depth, ow = itemSize(o).width;
    const back = dot(sub({ x: o.position.x, y: o.position.y }, wall.start), n) - od / 2;
    if (Math.abs(back) > 30 || Math.abs(Math.cos(o.rotation - rotation) - 1) > 1e-3) continue;
    const os = dot(sub({ x: o.position.x, y: o.position.y }, wall.start), dir);
    if (verticalOverlap(o, item)) {
      candidates.push({ s: os + ow / 2 + w / 2, priority: 0 }, { s: os - ow / 2 - w / 2, priority: 0 });
    } else {
      // Different layer (e.g. wall cabinet above a base): line up edges or centres.
      candidates.push(
        { s: os - ow / 2 + w / 2, priority: 1 },
        { s: os + ow / 2 - w / 2, priority: 1 },
        { s: os, priority: 1 },
      );
    }
  }
  let snapped: { s: number; dist: number; priority: number } | null = null;
  for (const cand of candidates) {
    const dist = Math.abs(cand.s - s);
    if (dist > SNAP || cand.s < w / 2 - 1 || cand.s > L - w / 2 + 1) continue;
    if (!snapped || cand.priority < snapped.priority || (cand.priority === snapped.priority && dist < snapped.dist)) {
      snapped = { s: cand.s, dist, priority: cand.priority };
    }
  }
  if (snapped) s = snapped.s;

  const centre = add(add(wall.start, scale(dir, s)), scale(n, d / 2));
  return { x: centre.x, y: centre.y, rotation, wall: hit.i };
}

/** Centre and rotation for an item placed flat against wall `wallIndex`, its left edge `offset` mm along the wall. */
export function placeOnWall(room: Room, wallIndex: number, width: Mm, depth: Mm, offset: Mm): { x: Mm; y: Mm; rotation: number } {
  const wall = room.walls[wallIndex]!;
  const dir = wallDir(wall), n = wallInwardNormal(room, wallIndex);
  const c = add(add(wall.start, scale(dir, offset + width / 2)), scale(n, depth / 2));
  return { x: c.x, y: c.y, rotation: rotationFacing(n) };
}
