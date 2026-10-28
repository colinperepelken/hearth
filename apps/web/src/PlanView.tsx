import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  add,
  bounds,
  catalogItem,
  dot,
  footprint,
  formatLength,
  inches,
  itemSize,
  moveVertex,
  moveWall,
  roomVertices,
  scale,
  snapItem,
  splitWall,
  sub,
  wallDir,
  wallInwardNormal,
  wallLength,
  type PlacedItem,
  type Project,
  type Vec2,
} from '@hearth/core';
import { room, useHearth } from './doc';

type Gesture =
  | { type: 'pan'; startClient: Vec2; startCentre: Vec2 }
  | { type: 'vertex'; index: number; orig: Project }
  | { type: 'wall'; index: number; start: Vec2; orig: Project }
  | { type: 'opening'; wall: number; id: string; start: Vec2; orig: Project }
  | { type: 'item'; id: string; start: Vec2; orig: Project }
  | { type: 'underlay'; start: Vec2; orig: Project };

/** Short plan label: B30, W30x36, Range… */
export function shortLabel(item: PlacedItem): string {
  const c = catalogItem(item.catalogId);
  const { width, height } = itemSize(item);
  const w = Math.round(width / 25.4);
  const r = c.render;
  if (r.type === 'cabinet') {
    if (r.sink) return `SB${w}`;
    if (r.kind === 'wall') return `W${w}×${Math.round(height / 25.4)}`;
    if (r.kind === 'tall') return `T${w}`;
    return r.front.type === 'drawers' ? `DB${w}` : `B${w}`;
  }
  if (r.type === 'appliance') {
    const names: Record<string, string> = {
      range: 'Range', 'fridge-french': 'Fridge', 'fridge-top-freezer': 'Fridge', dishwasher: 'DW', 'microwave-otr': 'OTR MW',
      'microwave-counter': 'MW', 'hood-chimney': 'Hood', 'hood-under-cabinet': 'Hood', 'wall-oven': 'Oven',
    };
    return names[r.appliance] ?? c.name;
  }
  return '';
}

const snapIn = (v: number, imperial: boolean) => (imperial ? Math.round(v / inches(0.5)) * inches(0.5) : Math.round(v / 5) * 5);

export function PlanView({ editable }: { editable: 'room' | 'design' }) {
  const project = useHearth((s) => s.project);
  const selection = useHearth((s) => s.selection);
  const calibration = useHearth((s) => s.calibration);
  const moveUnderlay = useHearth((s) => s.moveUnderlay);
  const { edit, checkpoint, select, set } = useHearth.getState();
  const r = room(project);
  const underlay = project.building.levels[0]!.underlay;
  const imperial = project.units === 'imperial';

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ cx: 2000, cy: 1600, zoom: 0.15 });
  const gesture = useRef<Gesture | null>(null);
  const pendingCheckpoint = useRef(false);

  useLayoutEffect(() => {
    const el = svgRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const b = bounds(roomVertices(room(useHearth.getState().project)));
    const pad = 900;
    const zoom = Math.min(size.w / (b.maxX - b.minX + pad * 2), size.h / (b.maxY - b.minY + pad * 2));
    setView({ cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, zoom });
  }, [size.w, size.h]);
  useEffect(() => fit(), [fit]);

  const toPlan = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - size.w / 2) / view.zoom + view.cx, y: (clientY - rect.top - size.h / 2) / view.zoom + view.cy };
  };

  // Lets the catalog drop items here.
  useEffect(() => {
    planDrop.toPlan = toPlan;
  });

  const onWheel = (e: React.WheelEvent) => {
    const p = toPlan(e.clientX, e.clientY);
    const zoom = Math.min(2, Math.max(0.02, view.zoom * Math.exp(-e.deltaY * 0.0015)));
    // Keep the point under the cursor fixed.
    setView({ zoom, cx: p.x - (p.x - view.cx) * (view.zoom / zoom), cy: p.y - (p.y - view.cy) * (view.zoom / zoom) });
  };

  const begin = (e: React.PointerEvent, g: Gesture) => {
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    // Record undo history on the first actual move, so plain clicks don't add empty steps.
    pendingCheckpoint.current = g.type !== 'pan';
    gesture.current = g;
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    const p = toPlan(e.clientX, e.clientY);
    if (calibration && calibration.points.length < 2) {
      set({ calibration: { points: [...calibration.points, p] } });
      return;
    }
    if (moveUnderlay && underlay) {
      begin(e, { type: 'underlay', start: p, orig: project });
      return;
    }
    select(null);
    begin(e, { type: 'pan', startClient: { x: e.clientX, y: e.clientY }, startCentre: { x: view.cx, y: view.cy } });
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (pendingCheckpoint.current) {
      checkpoint();
      pendingCheckpoint.current = false;
    }
    const p = toPlan(e.clientX, e.clientY);
    switch (g.type) {
      case 'pan':
        setView((v) => ({ ...v, cx: g.startCentre.x - (e.clientX - g.startClient.x) / v.zoom, cy: g.startCentre.y - (e.clientY - g.startClient.y) / v.zoom }));
        break;
      case 'vertex': {
        const verts = roomVertices(room(g.orig));
        let x = snapIn(p.x, imperial), y = snapIn(p.y, imperial);
        // Line up with other corners so walls stay square.
        const tol = 10 / view.zoom;
        verts.forEach((v, i) => {
          if (i === g.index) return;
          if (Math.abs(v.x - p.x) < tol) x = v.x;
          if (Math.abs(v.y - p.y) < tol) y = v.y;
        });
        edit((d) => moveVertex(room(d), g.index, { x, y }), { history: false });
        break;
      }
      case 'wall': {
        edit(
          (d) => {
            const rr = room(d);
            rr.walls = structuredClone(room(g.orig).walls);
            const out = scale(wallInwardNormal(rr, g.index), -1);
            moveWall(rr, g.index, snapIn(dot(sub(p, g.start), out), imperial));
          },
          { history: false },
        );
        break;
      }
      case 'opening': {
        const w0 = room(g.orig).walls[g.wall]!;
        const o0 = w0.openings.find((o) => o.id === g.id)!;
        const offset = Math.max(0, Math.min(wallLength(w0) - o0.width, snapIn(o0.offset + dot(sub(p, g.start), wallDir(w0)), imperial)));
        edit((d) => void (room(d).walls[g.wall]!.openings.find((o) => o.id === g.id)!.offset = offset), { history: false });
        break;
      }
      case 'item': {
        const rr = room(g.orig);
        const it = rr.items.find((i) => i.id === g.id)!;
        const target = add({ x: it.position.x, y: it.position.y }, sub(p, g.start));
        const s = snapItem(rr, rr.items, it, target);
        edit(
          (d) => {
            const di = room(d).items.find((i) => i.id === g.id)!;
            di.position.x = s.x;
            di.position.y = s.y;
            di.rotation = s.rotation;
          },
          { history: false },
        );
        break;
      }
      case 'underlay': {
        const u = g.orig.building.levels[0]!.underlay!;
        const delta = sub(p, g.start);
        edit((d) => void (d.building.levels[0]!.underlay!.origin = add(u.origin, delta)), { history: false });
        break;
      }
    }
  };

  const onUp = () => {
    gesture.current = null;
  };

  const px = 1 / view.zoom; // one screen pixel in mm
  const verts = roomVertices(r);
  const poly = verts.map((v) => `${v.x},${v.y}`).join(' ');
  const t = r.walls[0]?.thickness ?? 150;
  const gridStep = imperial ? inches(12) : 500;

  return (
    <svg
      ref={svgRef}
      className={`plan ${calibration ? 'calibrating' : ''} ${moveUnderlay ? 'moving' : ''}`}
      onPointerDown={onBackgroundDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onWheel={onWheel}
    >
      <defs>
        <pattern id="grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
          <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="var(--grid)" strokeWidth={px} />
        </pattern>
      </defs>
      <g transform={`translate(${size.w / 2} ${size.h / 2}) scale(${view.zoom}) translate(${-view.cx} ${-view.cy})`}>
        <rect x={view.cx - size.w * px} y={view.cy - size.h * px} width={size.w * px * 2} height={size.h * px * 2} fill="url(#grid)" />
        {underlay && (
          <image
            href={underlay.src}
            x={underlay.origin.x}
            y={underlay.origin.y}
            width={underlay.pixelWidth * underlay.mmPerPixel}
            height={underlay.pixelHeight * underlay.mmPerPixel}
            opacity={underlay.opacity}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Walls: a thick mitred stroke, with the floor drawn over its inner half. */}
        <polygon points={poly} fill="none" stroke="var(--wall)" strokeWidth={t * 2} strokeLinejoin="miter" />
        <polygon points={poly} fill="var(--plan-floor)" fillOpacity={underlay ? 0.55 : 1} />

        {r.walls.map((w, i) => {
          const out = scale(wallInwardNormal(r, i), -1);
          const q = [w.start, w.end, add(w.end, scale(out, w.thickness)), add(w.start, scale(out, w.thickness))];
          const sel = selection?.kind === 'wall' && selection.index === i;
          const mid = scale(add(w.start, w.end), 0.5);
          const label = add(mid, scale(out, w.thickness + 22 * px));
          return (
            <g key={w.id}>
              <polygon
                points={q.map((v) => `${v.x},${v.y}`).join(' ')}
                className={editable === 'room' ? 'hit wall' : 'hit'}
                fill={sel ? 'var(--accent)' : 'transparent'}
                fillOpacity={sel ? 0.55 : 0}
                onPointerDown={(e) => {
                  if (editable !== 'room' || calibration) return;
                  select({ kind: 'wall', index: i });
                  begin(e, { type: 'wall', index: i, start: toPlan(e.clientX, e.clientY), orig: project });
                }}
                onDoubleClick={() => editable === 'room' && edit((d) => splitWall(room(d), i))}
              />
              <text
                x={label.x}
                y={label.y}
                fontSize={12 * px}
                className="dim"
                textAnchor="middle"
                dominantBaseline="middle"
                onPointerDown={(e) => {
                  if (editable !== 'room') return;
                  e.stopPropagation();
                  select({ kind: 'wall', index: i });
                }}
              >
                {formatLength(wallLength(w), project.units)}
              </text>
              {w.openings.map((o) => {
                const d = wallDir(w);
                const a = add(w.start, scale(d, o.offset)), b = add(w.start, scale(d, o.offset + o.width));
                const gap = [a, b, add(b, scale(out, w.thickness)), add(a, scale(out, w.thickness))];
                const osel = selection?.kind === 'opening' && selection.id === o.id;
                const n = wallInwardNormal(r, i);
                return (
                  <g
                    key={o.id}
                    className={editable === 'room' ? 'hit opening' : ''}
                    onPointerDown={(e) => {
                      if (editable !== 'room' || calibration) return;
                      select({ kind: 'opening', wall: i, id: o.id });
                      begin(e, { type: 'opening', wall: i, id: o.id, start: toPlan(e.clientX, e.clientY), orig: project });
                    }}
                  >
                    <polygon points={gap.map((v) => `${v.x},${v.y}`).join(' ')} fill="var(--plan-floor)" stroke={osel ? 'var(--accent)' : 'var(--ink)'} strokeWidth={(osel ? 2 : 1) * px} />
                    {o.kind === 'window' ? (
                      <line
                        x1={add(a, scale(out, w.thickness / 2)).x}
                        y1={add(a, scale(out, w.thickness / 2)).y}
                        x2={add(b, scale(out, w.thickness / 2)).x}
                        y2={add(b, scale(out, w.thickness / 2)).y}
                        stroke="var(--ink)"
                        strokeWidth={px}
                      />
                    ) : (
                      <path
                        d={`M ${a.x} ${a.y} L ${add(a, scale(n, o.width)).x} ${add(a, scale(n, o.width)).y} A ${o.width} ${o.width} 0 0 ${dot(d, { x: -n.y, y: n.x }) > 0 ? 0 : 1} ${b.x} ${b.y}`}
                        fill="none"
                        stroke="var(--ink)"
                        strokeWidth={px}
                        strokeDasharray={`${4 * px} ${3 * px}`}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {[...r.items]
          .sort((a, b) => a.position.z - b.position.z)
          .map((it) => {
            const c = catalogItem(it.catalogId);
            const fp = footprint(it);
            const sel = selection?.kind === 'item' && selection.id === it.id;
            const raised = it.position.z > 1000;
            const fill = c.category === 'appliances' ? 'var(--plan-appliance)' : c.category === 'furniture' ? 'var(--plan-furniture)' : 'var(--plan-cabinet)';
            const centre = { x: it.position.x, y: it.position.y };
            const front = add(centre, scale({ x: -Math.sin(it.rotation), y: Math.cos(it.rotation) }, itemSize(it).depth / 2 - 30));
            return (
              <g
                key={it.id}
                className={editable === 'design' ? 'hit item' : 'faded'}
                onPointerDown={(e) => {
                  if (editable !== 'design') return;
                  select({ kind: 'item', id: it.id });
                  begin(e, { type: 'item', id: it.id, start: toPlan(e.clientX, e.clientY), orig: project });
                }}
              >
                <polygon
                  points={fp.map((v) => `${v.x},${v.y}`).join(' ')}
                  fill={raised ? 'transparent' : fill}
                  stroke={sel ? 'var(--accent)' : 'var(--ink-2)'}
                  strokeWidth={(sel ? 2.5 : 1) * px}
                  strokeDasharray={raised ? `${5 * px} ${3 * px}` : undefined}
                />
                {c.snap === 'wall' && <circle cx={front.x} cy={front.y} r={2.5 * px} fill="var(--ink-2)" />}
                {view.zoom > 0.08 && (
                  <text x={centre.x} y={centre.y + (raised ? 14 * px : 0)} fontSize={10 * px} className="label" textAnchor="middle" dominantBaseline="middle">
                    {shortLabel(it)}
                  </text>
                )}
              </g>
            );
          })}

        {editable === 'room' &&
          !calibration &&
          verts.map((v, i) => (
            <circle
              key={i}
              cx={v.x}
              cy={v.y}
              r={6 * px}
              className="vertex"
              onPointerDown={(e) => begin(e, { type: 'vertex', index: i, orig: project })}
            />
          ))}

        {calibration?.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5 * px} fill="var(--accent)" />
        ))}
        {calibration?.points.length === 2 && (
          <line
            x1={calibration.points[0]!.x}
            y1={calibration.points[0]!.y}
            x2={calibration.points[1]!.x}
            y2={calibration.points[1]!.y}
            stroke="var(--accent)"
            strokeWidth={2 * px}
          />
        )}
      </g>
      <foreignObject x={8} y={8} width={60} height={30}>
        <button className="chip" onClick={fit} onPointerDown={(e) => e.stopPropagation()}>
          Fit
        </button>
      </foreignObject>
    </svg>
  );
}

/** Set by the mounted PlanView so drops from the catalog can be converted to plan coordinates. */
export const planDrop: { toPlan: ((x: number, y: number) => Vec2) | null } = { toPlan: null };
