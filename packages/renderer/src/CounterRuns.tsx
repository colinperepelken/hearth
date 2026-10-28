import {
  STANDARD,
  catalogItem,
  dot,
  inches,
  itemSize,
  overhangOf,
  sinkOptions,
  sub,
  toMetres as m,
  wallInwardNormal,
  type BacksplashStyleId,
  type CountertopId,
  type PlacedItem,
  type Room,
  type SinkOptions,
  type Vec2,
} from '@hearth/core';
import { Backsplash, Countertop } from './Countertop';

export interface CounterRun {
  /** Plan back-left corner of the countertop, mm. */
  origin: Vec2;
  rotation: number;
  length: number;
  depth: number;
  /** Countertop past the cabinets' backs (seating overhang on islands), mm. */
  back: number;
  /** Depth of the cabinets under the top, mm (front faces sit at back + cabinetDepth). */
  cabinetDepth: number;
  sink?: { centerX: number; width: number; options: SinkOptions };
  /** Wall behind the run, if it sits against one. */
  wall: number | null;
  /** Backsplash only (a range): no countertop. */
  splashOnly?: boolean;
}

const dirOf = (rotation: number) => ({ x: Math.cos(rotation), y: Math.sin(rotation) });
const normalOf = (rotation: number) => ({ x: -Math.sin(rotation), y: Math.cos(rotation) });

function wallBehind(room: Room, n: Vec2, backPoint: Vec2): number | null {
  let wall: number | null = null;
  room.walls.forEach((w, i) => {
    const wn = wallInwardNormal(room, i);
    if (dot(wn, n) > 0.999 && Math.abs(dot(sub(backPoint, w.start), wn)) < 30) wall = i;
  });
  return wall;
}

/**
 * Groups base cabinets (and under-counter appliances) that sit side by side, facing the same way,
 * into continuous countertop runs. Ranges against a wall become backsplash-only runs.
 */
export function counterRuns(room: Room, items: PlacedItem[]): CounterRun[] {
  type Entry = { item: PlacedItem; a0: number; a1: number; back: number; depth: number };
  const groups = new Map<string, { rotation: number; entries: Entry[] }>();
  const runs: CounterRun[] = [];

  for (const it of items) {
    const c = catalogItem(it.catalogId);
    if (it.position.z > 10) continue;
    const { width, depth } = itemSize(it);
    const dirX = dirOf(it.rotation), n = normalOf(it.rotation);
    const p = { x: it.position.x, y: it.position.y };
    const along = dot(p, dirX);
    const back = dot(p, n) - depth / 2;
    if (c.render.type === 'appliance' && c.render.appliance === 'range') {
      const origin = { x: dirX.x * (along - width / 2) + n.x * back, y: dirX.y * (along - width / 2) + n.y * back };
      const wall = wallBehind(room, n, origin);
      if (wall !== null) runs.push({ origin, rotation: it.rotation, length: width, depth, back: 0, cabinetDepth: depth, wall, splashOnly: true });
      continue;
    }
    if (!c.counter) continue;
    const key = `${Math.round(((it.rotation % (2 * Math.PI)) + 2 * Math.PI) * 1000) % 6283}:${Math.round(back / 20)}`;
    const g = groups.get(key) ?? { rotation: it.rotation, entries: [] };
    g.entries.push({ item: it, a0: along - width / 2, a1: along + width / 2, back, depth });
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const dirX = dirOf(g.rotation), n = normalOf(g.rotation);
    g.entries.sort((a, b) => a.a0 - b.a0);
    let cur: Entry[] = [];
    const flush = () => {
      if (!cur.length) return;
      const oh = cur.map((e) => overhangOf(e.item));
      const front = Math.max(...oh.map((o) => o.front));
      const backOh = Math.max(...oh.map((o) => o.back));
      const left = oh[0]!.left, right = oh[oh.length - 1]!.right;
      const a0 = cur[0]!.a0 - left, a1 = Math.max(...cur.map((e) => e.a1)) + right;
      const back = Math.min(...cur.map((e) => e.back));
      const cabinetDepth = Math.max(...cur.map((e) => e.depth));
      const origin = { x: dirX.x * a0 + n.x * (back - backOh), y: dirX.y * a0 + n.y * (back - backOh) };
      const sinkEntry = cur.find((e) => {
        const r = catalogItem(e.item.catalogId).render;
        return r.type === 'cabinet' && r.sink;
      });
      runs.push({
        origin,
        rotation: g.rotation,
        length: a1 - a0,
        depth: backOh + cabinetDepth + front,
        back: backOh,
        cabinetDepth,
        sink: sinkEntry
          ? { centerX: (sinkEntry.a0 + sinkEntry.a1) / 2 - a0, width: sinkEntry.a1 - sinkEntry.a0 - inches(6), options: sinkOptions(sinkEntry.item) }
          : undefined,
        wall: backOh > 0 ? null : wallBehind(room, n, origin),
      });
      cur = [];
    };
    for (const e of g.entries) {
      if (cur.length && e.a0 - Math.max(...cur.map((c) => c.a1)) > 5) flush();
      cur.push(e);
    }
    flush();
  }
  return runs;
}

/**
 * Backsplash pieces along a run: cut around windows and doors, and each reaching up to whatever
 * hangs above it (wall cabinets, a hood or microwave) or `fallbackTop`.
 */
function backsplashSpans(room: Room, run: CounterRun, items: PlacedItem[], fallbackTop: number) {
  const bottom = STANDARD.base.height + STANDARD.countertop.thickness;
  const dirX = dirOf(run.rotation), n = normalOf(run.rotation);
  const cuts: { x0: number; x1: number; sill: number }[] = [];
  const above: { x0: number; x1: number; z: number }[] = [];
  const w = room.walls[run.wall!]!;
  const wd = { x: w.end.x - w.start.x, y: w.end.y - w.start.y };
  const wl = Math.hypot(wd.x, wd.y) || 1;
  for (const o of w.openings) {
    const p0 = { x: w.start.x + (wd.x / wl) * o.offset, y: w.start.y + (wd.y / wl) * o.offset };
    const p1 = { x: w.start.x + (wd.x / wl) * (o.offset + o.width), y: w.start.y + (wd.y / wl) * (o.offset + o.width) };
    const a = dot(sub(p0, run.origin), dirX), b = dot(sub(p1, run.origin), dirX);
    cuts.push({ x0: Math.min(a, b) - 90, x1: Math.max(a, b) + 90, sill: o.sillHeight }); // include casing
  }
  const wallLine = dot(w.start, n);
  for (const it of items) {
    if (it.position.z < 1000 || Math.abs(Math.cos(it.rotation - run.rotation) - 1) > 1e-3) continue;
    const { width, depth } = itemSize(it);
    const p = { x: it.position.x, y: it.position.y };
    if (Math.abs(dot(p, n) - depth / 2 - wallLine) > 30) continue;
    const a = dot(sub(p, run.origin), dirX);
    above.push({ x0: a - width / 2, x1: a + width / 2, z: it.position.z });
  }

  const edges = [0, run.length, ...cuts.flatMap((c) => [c.x0, c.x1]), ...above.flatMap((c) => [c.x0, c.x1])]
    .filter((x) => x >= 0 && x <= run.length)
    .sort((a, b) => a - b);
  const spans: { x0: number; x1: number; height: number }[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i]!, x1 = edges[i + 1]!;
    if (x1 - x0 < 1) continue;
    const mid = (x0 + x1) / 2;
    const over = above.filter((c) => mid > c.x0 && mid < c.x1).map((c) => c.z);
    let top = over.length ? Math.min(...over) : fallbackTop;
    const cut = cuts.find((c) => mid > c.x0 && mid < c.x1);
    if (cut) top = Math.min(top, cut.sill - 25);
    if (top - bottom > 20) spans.push({ x0, x1, height: top - bottom });
  }
  return { bottom, spans };
}

export function CounterRuns({
  room,
  items,
  countertop,
  backsplash,
}: {
  room: Room;
  items: PlacedItem[];
  countertop: CountertopId;
  backsplash: { style: BacksplashStyleId; color: string };
}) {
  const runs = counterRuns(room, items);
  return (
    <group>
      {runs.map((run, i) => {
        // Behind a range with nothing above, tile up to 6'.
        const { bottom, spans } = run.wall !== null ? backsplashSpans(room, run, items, run.splashOnly ? inches(72) : STANDARD.wallCabinetBottom) : { bottom: 0, spans: [] };
        return (
          <group key={i} position={[m(run.origin.x), 0, m(run.origin.y)]} rotation={[0, -run.rotation, 0]}>
            {!run.splashOnly && (
              <group position={[0, m(STANDARD.base.height), 0]}>
                <Countertop
                  length={m(run.length)}
                  depth={m(run.depth)}
                  thickness={m(STANDARD.countertop.thickness)}
                  material={countertop}
                  sink={
                    run.sink
                      ? {
                          centerX: m(run.sink.centerX),
                          width: m(run.sink.width),
                          depth: m(inches(16)),
                          back: m(run.back + inches(4)),
                          front: m(run.back + run.cabinetDepth),
                          options: run.sink.options,
                        }
                      : undefined
                  }
                />
              </group>
            )}
            {spans.map((s) => (
              <Backsplash key={s.x0} x={m(s.x0)} y={m(bottom)} width={m(s.x1 - s.x0)} height={m(s.height)} style={backsplash.style} color={backsplash.color} countertop={countertop} />
            ))}
          </group>
        );
      })}
    </group>
  );
}
