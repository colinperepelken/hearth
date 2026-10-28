import type { Id, Opening, Room, Vec2, Wall } from './model';
import type { Mm } from './units';

/**
 * Plan geometry. Plan coordinates are mm with x to the right and y down the screen
 * (y maps to +z in the 3D scene). A room's walls form a closed loop: wall i ends where wall i+1 starts.
 */

export const DEFAULT_WALL_THICKNESS: Mm = 150;

let counter = 0;
export const newId = (prefix: string): Id => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

export function roomVertices(room: Room): Vec2[] {
  return room.walls.map((w) => w.start);
}

/** Positive when vertices run clockwise on screen (y down). */
export function signedArea(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function wallLength(w: Wall): Mm {
  return len(sub(w.end, w.start));
}

export function wallDir(w: Wall): Vec2 {
  return norm(sub(w.end, w.start));
}

/** Unit normal pointing into the room. */
export function wallInwardNormal(room: Room, i: number): Vec2 {
  const d = wallDir(room.walls[i]!);
  const cw = signedArea(roomVertices(room)) > 0;
  // Clockwise on screen (y down): interior is to the right of travel, i.e. (-d.y, d.x).
  return cw ? { x: -d.y, y: d.x } : { x: d.y, y: -d.x };
}

/** True when the corner at the start of wall i turns towards the interior (a normal, convex corner). */
export function isConvexCorner(room: Room, i: number): boolean {
  const n = room.walls.length;
  const prev = room.walls[(i - 1 + n) % n]!, cur = room.walls[i]!;
  const c = cross(wallDir(prev), wallDir(cur));
  return signedArea(roomVertices(room)) > 0 ? c > 0 : c < 0;
}

export function pointInPolygon(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function bounds(pts: Vec2[]) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Closest point on segment ab to p, with t in 0..1 along the segment. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  const q = add(a, scale(ab, t));
  return { point: q, t, distance: len(sub(p, q)) };
}

function wallsFromPoints(pts: Vec2[], height: Mm): Wall[] {
  return pts.map((p, i) => ({
    id: newId('wall'),
    start: { ...p },
    end: { ...pts[(i + 1) % pts.length]! },
    thickness: DEFAULT_WALL_THICKNESS,
    height,
    openings: [],
  }));
}

export function rectangleWalls(width: Mm, depth: Mm, height: Mm): Wall[] {
  return wallsFromPoints(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: depth },
      { x: 0, y: depth },
    ],
    height,
  );
}

/** L-shaped room: a width x depth rectangle with a notch cut from the bottom-right corner. */
export function lShapeWalls(width: Mm, depth: Mm, notchWidth: Mm, notchDepth: Mm, height: Mm): Wall[] {
  return wallsFromPoints(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: depth - notchDepth },
      { x: width - notchWidth, y: depth - notchDepth },
      { x: width - notchWidth, y: depth },
      { x: 0, y: depth },
    ],
    height,
  );
}

export function wallsFromPolygon(pts: Vec2[], height: Mm): Wall[] {
  return wallsFromPoints(pts, height);
}

/** Moves vertex i (start of wall i, end of wall i-1). */
export function moveVertex(room: Room, i: number, p: Vec2) {
  const n = room.walls.length;
  room.walls[i]!.start = { ...p };
  room.walls[(i - 1 + n) % n]!.end = { ...p };
}

/** Moves wall i along its normal by `delta` mm (positive = outward); neighbouring walls stretch. */
export function moveWall(room: Room, i: number, delta: Mm) {
  const n = room.walls.length;
  const w = room.walls[i]!;
  const out = scale(wallInwardNormal(room, i), -1);
  const prev = room.walls[(i - 1 + n) % n]!, next = room.walls[(i + 1) % n]!;
  // Slide each endpoint along its neighbouring wall so that wall stays straight; if the
  // neighbour is parallel (no corner), move straight out instead.
  const slide = (p: Vec2, neighbour: Wall) => {
    const d = wallDir(neighbour);
    const k = dot(d, out);
    return Math.abs(k) > 0.2 ? add(p, scale(d, delta / k)) : add(p, scale(out, delta));
  };
  const newStart = slide(w.start, prev);
  const newEnd = slide(w.end, next);
  moveVertex(room, i, newStart);
  moveVertex(room, (i + 1) % n, newEnd);
}

/**
 * Sets wall i's length by moving the following wall along wall i's direction,
 * which keeps right-angled rooms square.
 */
export function setWallLength(room: Room, i: number, length: Mm) {
  const n = room.walls.length;
  const w = room.walls[i]!;
  const delta = length - wallLength(w);
  const shift = scale(wallDir(w), delta);
  const next = room.walls[(i + 1) % n]!;
  const parallelNext = Math.abs(cross(wallDir(w), wallDir(next))) < 1e-6;
  // Move wall i's end and, unless the next wall continues straight, the next wall's end too.
  moveVertex(room, (i + 1) % n, add(w.end, shift));
  if (!parallelNext) moveVertex(room, (i + 2) % n, add(next.end, shift));
  clampOpenings(room.walls[i]!);
}

export function clampOpenings(w: Wall) {
  const l = wallLength(w);
  for (const o of w.openings) {
    o.width = Math.min(o.width, l);
    o.offset = Math.max(0, Math.min(o.offset, l - o.width));
  }
}

export function addOpening(room: Room, wallIndex: number, kind: Opening['kind']): Opening {
  const w = room.walls[wallIndex]!;
  const l = wallLength(w);
  const presets: Record<Opening['kind'], Omit<Opening, 'id' | 'offset' | 'kind'>> = {
    door: { width: 864, height: 2032, sillHeight: 0 }, // 34" x 80"
    window: { width: 914, height: 1067, sillHeight: 1067 }, // 36" x 42", 42" sill
    passthrough: { width: 1219, height: 2134, sillHeight: 0 },
  };
  const p = presets[kind];
  const o: Opening = { id: newId('open'), kind, ...p, width: Math.min(p.width, l), offset: Math.max(0, (l - p.width) / 2) };
  w.openings.push(o);
  return o;
}

/** Splits wall i at its midpoint, creating a corner that can be dragged. */
export function splitWall(room: Room, i: number) {
  const w = room.walls[i]!;
  const mid = scale(add(w.start, w.end), 0.5);
  const second: Wall = { ...w, id: newId('wall'), start: mid, end: { ...w.end }, openings: [] };
  const l1 = wallLength({ ...w, end: mid });
  second.openings = w.openings.filter((o) => o.offset >= l1).map((o) => ({ ...o, offset: o.offset - l1 }));
  w.openings = w.openings.filter((o) => o.offset < l1);
  w.end = { ...mid };
  clampOpenings(w);
  room.walls.splice(i + 1, 0, second);
}

/** Removes vertex i (joining walls i-1 and i). Rooms keep at least three walls. */
export function removeVertex(room: Room, i: number) {
  const n = room.walls.length;
  if (n <= 3) return;
  const prev = room.walls[(i - 1 + n) % n]!;
  prev.end = { ...room.walls[i]!.end };
  room.walls.splice(i, 1);
  clampOpenings(prev);
}
