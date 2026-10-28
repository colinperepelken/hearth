import {
  STANDARD,
  catalogItem,
  dot,
  inches,
  itemSize,
  sub,
  toMetres as m,
  wallInwardNormal,
  type BacksplashStyleId,
  type CountertopId,
  type PlacedItem,
  type Room,
  type Vec2,
} from '@hearth/core';
import { Backsplash, Countertop } from './Countertop';

export interface CounterRun {
  /** Plan back-left corner, mm. */
  origin: Vec2;
  rotation: number;
  length: number;
  depth: number;
  sink?: { centerX: number; width: number };
  /** Wall behind the run, if it sits against one. */
  wall: number | null;
}

/**
 * Groups base cabinets (and under-counter appliances) that sit side by side, facing the same way,
 * into continuous countertop runs.
 */
export function counterRuns(room: Room, items: PlacedItem[]): CounterRun[] {
  const members = items.filter((i) => {
    const c = catalogItem(i.catalogId);
    return c.counter && i.position.z < 10;
  });
  type Entry = { item: PlacedItem; a0: number; a1: number; back: number; depth: number; sink: boolean };
  const groups = new Map<string, { rotation: number; dirX: Vec2; n: Vec2; entries: Entry[] }>();
  for (const it of members) {
    const { width, depth } = itemSize(it);
    const dirX = { x: Math.cos(it.rotation), y: Math.sin(it.rotation) };
    const n = { x: -Math.sin(it.rotation), y: Math.cos(it.rotation) };
    const p = { x: it.position.x, y: it.position.y };
    const along = dot(p, dirX);
    // Back line uses the deepest standard cabinet so a shallower dishwasher still lines up.
    const back = dot(p, n) - depth / 2;
    const key = `${Math.round(((it.rotation % (2 * Math.PI)) + 2 * Math.PI) * 1000) % 6283}:${Math.round(back / 20)}`;
    const g = groups.get(key) ?? { rotation: it.rotation, dirX, n, entries: [] };
    g.entries.push({ item: it, a0: along - width / 2, a1: along + width / 2, back, depth, sink: catalogItem(it.catalogId).render.type === 'cabinet' && !!(catalogItem(it.catalogId).render as { sink?: boolean }).sink });
    groups.set(key, g);
  }

  const runs: CounterRun[] = [];
  for (const g of groups.values()) {
    g.entries.sort((a, b) => a.a0 - b.a0);
    let cur: Entry[] = [];
    const flush = () => {
      if (!cur.length) return;
      const a0 = cur[0]!.a0, a1 = Math.max(...cur.map((e) => e.a1));
      const back = Math.min(...cur.map((e) => e.back));
      const depth = Math.max(STANDARD.base.depth, ...cur.map((e) => e.depth)) + STANDARD.countertop.overhang;
      const origin = { x: g.dirX.x * a0 + g.n.x * back, y: g.dirX.y * a0 + g.n.y * back };
      const sinkEntry = cur.find((e) => e.sink);
      let wall: number | null = null;
      room.walls.forEach((w, i) => {
        const wn = wallInwardNormal(room, i);
        if (dot(wn, g.n) > 0.999 && Math.abs(dot(sub(origin, w.start), wn)) < 30) wall = i;
      });
      runs.push({
        origin,
        rotation: g.rotation,
        length: a1 - a0,
        depth,
        sink: sinkEntry ? { centerX: (sinkEntry.a0 + sinkEntry.a1) / 2 - a0, width: sinkEntry.a1 - sinkEntry.a0 - inches(6) } : undefined,
        wall,
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

/** Splits [0, length] around windows and doors on the wall behind a run, for the backsplash. */
function backsplashSpans(room: Room, run: CounterRun, top: number) {
  const bottom = STANDARD.base.height + STANDARD.countertop.thickness;
  const spans: { x0: number; x1: number; height: number }[] = [];
  const dirX = { x: Math.cos(run.rotation), y: Math.sin(run.rotation) };
  const cuts: { x0: number; x1: number; sill: number }[] = [];
  if (run.wall !== null) {
    const w = room.walls[run.wall]!;
    const wd = { x: w.end.x - w.start.x, y: w.end.y - w.start.y };
    const wl = Math.hypot(wd.x, wd.y) || 1;
    for (const o of w.openings) {
      const p0 = { x: w.start.x + (wd.x / wl) * o.offset, y: w.start.y + (wd.y / wl) * o.offset };
      const p1 = { x: w.start.x + (wd.x / wl) * (o.offset + o.width), y: w.start.y + (wd.y / wl) * (o.offset + o.width) };
      const a = dot(sub(p0, run.origin), dirX), b = dot(sub(p1, run.origin), dirX);
      cuts.push({ x0: Math.min(a, b) - 90, x1: Math.max(a, b) + 90, sill: o.sillHeight }); // include casing
    }
  }
  const edges = [0, run.length, ...cuts.flatMap((c) => [c.x0, c.x1])].filter((x) => x >= 0 && x <= run.length).sort((a, b) => a - b);
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i]!, x1 = edges[i + 1]!;
    if (x1 - x0 < 1) continue;
    const mid = (x0 + x1) / 2;
    const cut = cuts.find((c) => mid > c.x0 && mid < c.x1);
    const height = cut ? Math.min(top, cut.sill - 25) - bottom : top - bottom;
    if (height > 20) spans.push({ x0, x1, height });
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
        const { bottom, spans } = run.wall !== null ? backsplashSpans(room, run, STANDARD.wallCabinetBottom) : { bottom: 0, spans: [] };
        return (
          <group key={i} position={[m(run.origin.x), 0, m(run.origin.y)]} rotation={[0, -run.rotation, 0]}>
            <group position={[0, m(STANDARD.base.height), 0]}>
              <Countertop
                length={m(run.length)}
                depth={m(run.depth)}
                thickness={m(STANDARD.countertop.thickness)}
                material={countertop}
                sink={run.sink ? { centerX: m(run.sink.centerX), width: m(run.sink.width), depth: m(inches(16)) } : undefined}
              />
            </group>
            {spans.map((s) => (
              <Backsplash key={s.x0} x={m(s.x0)} y={m(bottom)} width={m(s.x1 - s.x0)} height={m(s.height)} style={backsplash.style} color={backsplash.color} countertop={countertop} />
            ))}
          </group>
        );
      })}
    </group>
  );
}
