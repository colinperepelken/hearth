import { useState } from 'react';
import {
  CATALOG,
  catalogItem,
  formatLength,
  itemSize,
  newId,
  snapItem,
  type CatalogItem,
  type ItemCategory,
  type PlacedItem,
} from '@hearth/core';
import { LengthInput } from './LengthInput';
import { room, useHearth } from './doc';

const CATEGORIES: [ItemCategory, string][] = [
  ['cabinets', 'Cabinets'],
  ['appliances', 'Appliances'],
  ['furniture', 'Furniture'],
];

export const DRAG_TYPE = 'application/x-hearth-catalog';

function CatalogRow({ c }: { c: CatalogItem }) {
  const units = useHearth((s) => s.project.units);
  return (
    <button
      className="catalog-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, c.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => useHearth.getState().addItem(c.id)}
      title="Click to add, or drag into the view"
    >
      <span className="name">{c.name}</span>
      {c.brand && (
        <span className="muted small">
          {c.brand} {c.model}
        </span>
      )}
      <span className="muted small">
        {formatLength(c.width, units)} W · {formatLength(c.depth, units)} D · {formatLength(c.height, units)} H
      </span>
    </button>
  );
}

export function CatalogPanel() {
  const [cat, setCat] = useState<ItemCategory>('cabinets');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const items = CATALOG.filter((c) =>
    query ? `${c.name} ${c.brand ?? ''} ${c.model ?? ''} ${c.group}`.toLowerCase().includes(query) : c.category === cat,
  );
  const groups = [...new Set(items.map((c) => c.group))];
  return (
    <aside className="panel left">
      <h2>Add to kitchen</h2>
      <input className="search" placeholder="Search cabinets, appliances, brands…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      {!query && (
        <div className="segmented tabs">
          {CATEGORIES.map(([id, label]) => (
            <button key={id} className={cat === id ? 'on' : ''} onClick={() => setCat(id)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {groups.map((g) => (
        <section key={g} className="field">
          <h3>{g}</h3>
          {items
            .filter((c) => c.group === g)
            .map((c) => (
              <CatalogRow key={c.id} c={c} />
            ))}
        </section>
      ))}
      {cat === 'appliances' && !query && <p className="muted small">Sizes are approximate; confirm with the manufacturer's install guide before ordering.</p>}
    </aside>
  );
}

export function ItemInspector() {
  const project = useHearth((s) => s.project);
  const selection = useHearth((s) => s.selection);
  const { edit, deleteSelection, select } = useHearth.getState();
  const units = project.units;
  const r = room(project);
  const item = selection?.kind === 'item' ? r.items.find((i) => i.id === selection.id) : undefined;

  if (!item) {
    return (
      <aside className="panel">
        <h2>Design</h2>
        <p className="muted small">Click or drag items from the left to add them. Items snap against walls and line up with their neighbours.</p>
        <p className="muted small">Select an item to change its size, then drag it in the 3D view or the plan.</p>
        <ul className="muted small">
          <li>Delete / Backspace removes the selection</li>
          <li>R rotates 90°</li>
          <li>⌘Z / ⇧⌘Z undo and redo</li>
        </ul>
      </aside>
    );
  }

  const c = catalogItem(item.catalogId);
  const size = itemSize(item);
  const update = (fn: (i: PlacedItem) => void) => edit((p) => fn(room(p).items.find((i) => i.id === item.id)!));

  /** Changes width keeping the left edge in place, then re-snaps. */
  const setWidth = (w: number) =>
    edit((p) => {
      const rr = room(p);
      const it = rr.items.find((i) => i.id === item.id)!;
      const dw = (w - itemSize(it).width) / 2;
      it.options.width = w;
      it.position.x += Math.cos(it.rotation) * dw;
      it.position.y += Math.sin(it.rotation) * dw;
    });

  const duplicate = () => {
    const id = newId('item');
    edit((p) => {
      const rr = room(p);
      const copy = structuredClone(item);
      copy.id = id;
      const step = size.width;
      const target = { x: item.position.x + Math.cos(item.rotation) * step, y: item.position.y + Math.sin(item.rotation) * step };
      const s = snapItem(rr, rr.items, copy, target);
      Object.assign(copy.position, { x: s.x, y: s.y });
      copy.rotation = s.rotation;
      rr.items.push(copy);
    });
    select({ kind: 'item', id });
  };

  return (
    <aside className="panel">
      <h2>{c.name}</h2>
      {c.brand && (
        <p className="muted">
          {c.brand} {c.model}
        </p>
      )}
      <section className="field">
        <h3>Size</h3>
        {c.widths ? (
          <label className="row">
            <span>Width</span>
            <select value={Math.round(size.width)} onChange={(e) => setWidth(Number(e.target.value))}>
              {c.widths.map((w) => (
                <option key={w} value={Math.round(w)}>
                  {formatLength(w, units)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="row">
            <span>Width</span>
            <span>{formatLength(size.width, units)}</span>
          </label>
        )}
        {c.heights ? (
          <label className="row">
            <span>Height</span>
            <select value={Math.round(size.height)} onChange={(e) => update((i) => void (i.options.height = Number(e.target.value)))}>
              {c.heights.map((h) => (
                <option key={h} value={Math.round(h)}>
                  {formatLength(h, units)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="row">
            <span>Height</span>
            <span>{formatLength(size.height, units)}</span>
          </label>
        )}
        <label className="row">
          <span>Depth</span>
          <span>{formatLength(size.depth, units)}</span>
        </label>
      </section>
      <section className="field">
        <h3>Position</h3>
        <label className="row">
          <span>Height off floor</span>
          <LengthInput value={item.position.z} units={units} min={0} onChange={(z) => update((i) => void (i.position.z = z))} />
        </label>
        <label className="row">
          <span>X</span>
          <LengthInput value={item.position.x} units={units} min={-1e6} onChange={(x) => update((i) => void (i.position.x = x))} />
        </label>
        <label className="row">
          <span>Y</span>
          <LengthInput value={item.position.y} units={units} min={-1e6} onChange={(y) => update((i) => void (i.position.y = y))} />
        </label>
      </section>
      <div className="segmented">
        <button onClick={() => update((i) => void (i.rotation += Math.PI / 2))}>Rotate 90°</button>
        <button onClick={duplicate}>Duplicate</button>
        <button className="danger" onClick={deleteSelection}>
          Delete
        </button>
      </div>
    </aside>
  );
}
