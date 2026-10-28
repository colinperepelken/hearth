import { useRef, useState } from 'react';
import {
  addOpening,
  bounds,
  clampOpenings,
  feet,
  formatLength,
  inches,
  lShapeWalls,
  len,
  rectangleWalls,
  removeVertex,
  roomVertices,
  setWallLength,
  signedArea,
  sub,
  wallLength,
  type Opening,
  type Vec2,
} from '@hearth/core';
import { LengthInput } from './LengthInput';
import { level, room, useHearth } from './doc';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="row">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function RoomToolsPanel() {
  const project = useHearth((s) => s.project);
  const calibration = useHearth((s) => s.calibration);
  const moveUnderlay = useHearth((s) => s.moveUnderlay);
  const selection = useHearth((s) => s.selection);
  const { edit, set, select } = useHearth.getState();
  const units = project.units;
  const lvl = level(project);
  const [shape, setShape] = useState<'rect' | 'l'>('rect');
  const [dims, setDims] = useState({ w: feet(12), d: feet(11), nw: feet(4), nd: feet(4) });
  const [realDistance, setRealDistance] = useState(feet(10));
  const fileRef = useRef<HTMLInputElement>(null);
  const wallIndex = selection?.kind === 'wall' ? selection.index : selection?.kind === 'opening' ? selection.wall : null;

  const applyShape = () => {
    edit((p) => {
      const r = room(p);
      const h = level(p).ceilingHeight;
      r.walls = shape === 'rect' ? rectangleWalls(dims.w, dims.d, h) : lShapeWalls(dims.w, dims.d, dims.nw, dims.nd, h);
    });
    select(null);
  };

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        edit((p) => {
          const b = bounds(roomVertices(room(p)));
          // Start the image at roughly the room's width; calibrate for an exact scale.
          level(p).underlay = {
            src,
            pixelWidth: img.naturalWidth,
            pixelHeight: img.naturalHeight,
            mmPerPixel: (b.maxX - b.minX + 1000) / img.naturalWidth,
            origin: { x: b.minX - 500, y: b.minY - 500 },
            opacity: 0.6,
          };
        });
        set({ layout: 'plan' });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const applyCalibration = () => {
    const [a, b] = calibration!.points as [Vec2, Vec2];
    const measured = len(sub(b, a));
    if (!measured) return;
    const k = realDistance / measured;
    edit((p) => {
      const u = level(p).underlay!;
      u.mmPerPixel *= k;
      // Scale about the first point so it stays put.
      u.origin = { x: a.x + (u.origin.x - a.x) * k, y: a.y + (u.origin.y - a.y) * k };
    });
    set({ calibration: null });
  };

  return (
    <aside className="panel left">
      <h2>Room</h2>

      <section className="field">
        <h3>Start from a shape</h3>
        <div className="segmented">
          <button className={shape === 'rect' ? 'on' : ''} onClick={() => setShape('rect')}>
            Rectangle
          </button>
          <button className={shape === 'l' ? 'on' : ''} onClick={() => setShape('l')}>
            L-shape
          </button>
        </div>
        <div className="grid2">
          <Row label="Width">
            <LengthInput value={dims.w} units={units} onChange={(w) => setDims({ ...dims, w })} />
          </Row>
          <Row label="Depth">
            <LengthInput value={dims.d} units={units} onChange={(d) => setDims({ ...dims, d })} />
          </Row>
          {shape === 'l' && (
            <>
              <Row label="Notch width">
                <LengthInput value={dims.nw} units={units} onChange={(nw) => setDims({ ...dims, nw })} />
              </Row>
              <Row label="Notch depth">
                <LengthInput value={dims.nd} units={units} onChange={(nd) => setDims({ ...dims, nd })} />
              </Row>
            </>
          )}
        </div>
        <button className="primary" onClick={applyShape}>
          Replace walls
        </button>
      </section>

      <section className="field">
        <h3>Ceiling height</h3>
        <LengthInput
          value={lvl.ceilingHeight}
          units={units}
          onChange={(h) =>
            edit((p) => {
              level(p).ceilingHeight = h;
              room(p).walls.forEach((w) => (w.height = h));
            })
          }
        />
      </section>

      <section className="field">
        <h3>Doors & windows</h3>
        <div className="segmented">
          {(['door', 'window', 'passthrough'] as const).map((k) => (
            <button
              key={k}
              disabled={wallIndex === null}
              onClick={() => {
                let id = '';
                edit((p) => void (id = addOpening(room(p), wallIndex!, k).id));
                select({ kind: 'opening', wall: wallIndex!, id });
              }}
            >
              + {k === 'passthrough' ? 'Opening' : k[0]!.toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        {wallIndex === null && <p className="muted small">Select a wall first.</p>}
      </section>

      <section className="field">
        <h3>Floorplan image</h3>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {!lvl.underlay ? (
          <button onClick={() => fileRef.current?.click()}>Upload PNG or JPEG…</button>
        ) : (
          <>
            <Row label="Opacity">
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={lvl.underlay.opacity}
                onChange={(e) => edit((p) => void (level(p).underlay!.opacity = Number(e.target.value)), { history: false })}
              />
            </Row>
            {!calibration ? (
              <div className="segmented">
                <button onClick={() => set({ calibration: { points: [] }, moveUnderlay: false, layout: 'plan' })}>Set scale</button>
                <button className={moveUnderlay ? 'on' : ''} onClick={() => set({ moveUnderlay: !moveUnderlay })}>
                  Move image
                </button>
                <button onClick={() => edit((p) => void delete level(p).underlay)}>Remove</button>
              </div>
            ) : (
              <div className="callout">
                {calibration.points.length < 2 ? (
                  <p>Click two points on the image that are a known distance apart (e.g. both ends of a dimensioned wall).</p>
                ) : (
                  <>
                    <Row label="Real distance">
                      <LengthInput value={realDistance} units={units} onChange={setRealDistance} />
                    </Row>
                    <button className="primary" onClick={applyCalibration}>
                      Apply scale
                    </button>
                  </>
                )}
                <button onClick={() => set({ calibration: null })}>Cancel</button>
              </div>
            )}
            <p className="muted small">After scaling, drag corners and walls to trace over the drawing.</p>
          </>
        )}
      </section>

      <section className="field tips">
        <h3>Tips</h3>
        <ul className="muted small">
          <li>Drag a corner or a wall to resize.</li>
          <li>Select a wall to type its exact length.</li>
          <li>Double-click a wall to add a corner.</li>
          <li>Drag doors and windows along their wall.</li>
        </ul>
      </section>
    </aside>
  );
}

export function RoomInspector() {
  const project = useHearth((s) => s.project);
  const selection = useHearth((s) => s.selection);
  const { edit, select, deleteSelection } = useHearth.getState();
  const r = room(project);
  const units = project.units;

  if (selection?.kind === 'wall') {
    const i = selection.index;
    const w = r.walls[i];
    if (!w) return <aside className="panel" />;
    return (
      <aside className="panel">
        <h2>Wall {i + 1}</h2>
        <Row label="Length">
          <LengthInput value={wallLength(w)} units={units} onChange={(l) => edit((p) => setWallLength(room(p), i, l))} />
        </Row>
        <Row label="Thickness">
          <LengthInput
            value={w.thickness}
            units={units}
            onChange={(t) => edit((p) => room(p).walls.forEach((x) => (x.thickness = t)))}
          />
        </Row>
        {w.openings.length > 0 && (
          <section className="field">
            <h3>Openings</h3>
            {w.openings.map((o) => (
              <button key={o.id} className="list" onClick={() => select({ kind: 'opening', wall: i, id: o.id })}>
                {o.kind} · {formatLength(o.width, units)}
              </button>
            ))}
          </section>
        )}
        <section className="field">
          <button disabled={r.walls.length <= 3} onClick={() => (edit((p) => removeVertex(room(p), i)), select(null))}>
            Remove corner at start of this wall
          </button>
        </section>
      </aside>
    );
  }

  if (selection?.kind === 'opening') {
    const w = r.walls[selection.wall];
    const o = w?.openings.find((x) => x.id === selection.id);
    if (!w || !o) return <aside className="panel" />;
    const update = (patch: Partial<Opening>) =>
      edit((p) => {
        const ww = room(p).walls[selection.wall]!;
        Object.assign(ww.openings.find((x) => x.id === o.id)!, patch);
        clampOpenings(ww);
      });
    return (
      <aside className="panel">
        <h2>{o.kind === 'passthrough' ? 'Opening' : o.kind[0]!.toUpperCase() + o.kind.slice(1)}</h2>
        <div className="segmented">
          {(['door', 'window', 'passthrough'] as const).map((k) => (
            <button
              key={k}
              className={o.kind === k ? 'on' : ''}
              onClick={() => update({ kind: k, sillHeight: k === 'window' ? inches(42) : 0, height: k === 'window' ? inches(42) : inches(80) })}
            >
              {k === 'passthrough' ? 'Opening' : k}
            </button>
          ))}
        </div>
        <Row label="Width">
          <LengthInput value={o.width} units={units} onChange={(width) => update({ width })} />
        </Row>
        <Row label="Height">
          <LengthInput value={o.height} units={units} onChange={(height) => update({ height })} />
        </Row>
        {o.kind === 'window' && (
          <Row label="Sill height">
            <LengthInput value={o.sillHeight} units={units} onChange={(sillHeight) => update({ sillHeight })} min={0} />
          </Row>
        )}
        <Row label="From wall start">
          <LengthInput value={o.offset} units={units} onChange={(offset) => update({ offset })} min={0} />
        </Row>
        <button className="danger" onClick={deleteSelection}>
          Delete
        </button>
      </aside>
    );
  }

  const verts = roomVertices(r);
  const area = Math.abs(signedArea(verts));
  const perimeter = r.walls.reduce((s, w) => s + wallLength(w), 0);
  return (
    <aside className="panel">
      <h2>Kitchen</h2>
      <Row label="Floor area">
        <span>{units === 'imperial' ? `${(area / 92903).toFixed(1)} sq ft` : `${(area / 1e6).toFixed(2)} m²`}</span>
      </Row>
      <Row label="Perimeter">
        <span>{formatLength(perimeter, units)}</span>
      </Row>
      <Row label="Walls">
        <span>{r.walls.length}</span>
      </Row>
      <p className="muted small">Select a wall, door or window in the plan to edit it.</p>
    </aside>
  );
}
