import { useEffect, useState } from 'react';
import {
  APPLIANCE_FINISHES,
  BACKSPLASH_STYLES,
  COUNTERTOPS,
  FLOORING,
  STAINS,
  TILE_COLOURS,
  WOOD_SPECIES,
  type Finishes,
  type WoodSpeciesId,
} from '@hearth/core';
import { countertopSwatch, floorSwatch, woodSwatch } from '@hearth/renderer';
import { PAINTS, useHearth } from './doc';

const HEX = /^#[0-9a-f]{6}$/i;

function ColourPicker({ label, value, presets, onChange }: { label: string; value: string; presets: readonly { name: string; hex: string; code?: string }[]; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const match = presets.find((p) => p.hex.toLowerCase() === value.toLowerCase());
  return (
    <section className="field">
      <h3>{label}</h3>
      <div className="swatches">
        {presets.map((p) => (
          <button
            key={p.hex}
            title={p.code ? `${p.name} (${p.code})` : p.name}
            className={p.hex.toLowerCase() === value.toLowerCase() ? 'swatch on' : 'swatch'}
            style={{ background: p.hex }}
            onClick={() => onChange(p.hex)}
          />
        ))}
      </div>
      <div className="hexrow">
        <input
          value={draft}
          spellCheck={false}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            setDraft(e.target.value);
            if (HEX.test(e.target.value)) onChange(e.target.value);
          }}
        />
        <span className="muted">{match ? (match.code ? `${match.name} · ${match.code}` : match.name) : 'Custom colour'}</span>
      </div>
    </section>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <section className="field">
      <h3>{label}</h3>
      <div className="segmented">
        {options.map(([v, text]) => (
          <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}

function ImageSwatches<T extends string>({ label, value, options, image, onChange }: { label: string; value: T; options: readonly { id: T; name: string }[]; image: (id: T) => string; onChange: (id: T) => void }) {
  return (
    <section className="field">
      <h3>{label}</h3>
      <div className="swatches">
        {options.map((o) => (
          <button key={o.id} title={o.name} className={o.id === value ? 'swatch on' : 'swatch'} style={{ backgroundImage: `url(${image(o.id)})` }} onClick={() => onChange(o.id)} />
        ))}
      </div>
      <span className="muted">{options.find((o) => o.id === value)?.name}</span>
    </section>
  );
}

export function FinishesPanel() {
  const f = useHearth((s) => s.project.finishes);
  const edit = useHearth((s) => s.edit);
  const set = (patch: Partial<Finishes>) => edit((p) => Object.assign(p.finishes, patch));
  const wood = f.cabinet.type === 'wood' ? f.cabinet : null;
  const [lastPaint, setLastPaint] = useState(f.cabinet.type === 'paint' ? f.cabinet.hex : '#ADAE8F');
  const [lastWood, setLastWood] = useState<{ species: WoodSpeciesId; stain: string }>(wood ?? { species: 'white-oak', stain: 'natural' });

  return (
    <aside className="panel finishes">
      <h2>Finishes</h2>

      <h4>Cabinets</h4>
      <Segmented
        label="Cabinet finish"
        value={f.cabinet.type}
        options={[
          ['paint', 'Paint'],
          ['wood', 'Wood'],
        ]}
        onChange={(t) => set({ cabinet: t === 'paint' ? { type: 'paint', hex: lastPaint } : { type: 'wood', ...lastWood } })}
      />
      {f.cabinet.type === 'paint' ? (
        <ColourPicker
          label="Cabinet paint"
          value={f.cabinet.hex}
          presets={PAINTS}
          onChange={(hex) => {
            setLastPaint(hex);
            set({ cabinet: { type: 'paint', hex } });
          }}
        />
      ) : (
        <>
          <ImageSwatches
            label="Wood"
            value={wood!.species}
            options={WOOD_SPECIES}
            image={(id) => woodSwatch(id, 'natural')}
            onChange={(species) => {
              setLastWood({ ...wood!, species });
              set({ cabinet: { ...wood!, species } });
            }}
          />
          <ImageSwatches
            label="Stain"
            value={wood!.stain}
            options={STAINS}
            image={(id) => woodSwatch(wood!.species, id)}
            onChange={(stain) => {
              setLastWood({ ...wood!, stain });
              set({ cabinet: { ...wood!, stain } });
            }}
          />
        </>
      )}
      <Segmented
        label="Door style"
        value={f.doorStyle}
        options={[
          ['shaker', 'Shaker'],
          ['slab', 'Slab'],
          ['raised-panel', 'Raised'],
        ]}
        onChange={(doorStyle) => set({ doorStyle })}
      />
      <Segmented
        label="Construction"
        value={f.system}
        options={[
          ['frameless', 'Frameless'],
          ['framed', 'Framed'],
        ]}
        onChange={(system) => set({ system })}
      />
      <Segmented
        label="Hardware"
        value={f.hardwareStyle}
        options={[
          ['bar', 'Bar pull'],
          ['knob', 'Knob'],
          ['cup', 'Cup + knob'],
        ]}
        onChange={(hardwareStyle) => set({ hardwareStyle })}
      />
      <Segmented
        label="Hardware finish"
        value={f.hardwareFinish}
        options={[
          ['brass', 'Brass'],
          ['black', 'Matte black'],
          ['nickel', 'Nickel'],
        ]}
        onChange={(hardwareFinish) => set({ hardwareFinish })}
      />

      <h4>Countertop & backsplash</h4>
      <ImageSwatches label="Countertop" value={f.countertop} options={COUNTERTOPS} image={countertopSwatch} onChange={(countertop) => set({ countertop })} />
      <Segmented
        label="Backsplash"
        value={f.backsplash.style}
        options={BACKSPLASH_STYLES.map((s) => [s.id, s.name] as const)}
        onChange={(style) => set({ backsplash: { ...f.backsplash, style } })}
      />
      {f.backsplash.style !== 'slab' && f.backsplash.style !== 'none' && (
        <ColourPicker label="Tile colour" value={f.backsplash.color} presets={TILE_COLOURS} onChange={(color) => set({ backsplash: { ...f.backsplash, color } })} />
      )}

      <h4>Room</h4>
      <ImageSwatches label="Flooring" value={f.floor} options={FLOORING} image={floorSwatch} onChange={(floor) => set({ floor })} />
      <ColourPicker label="Wall paint" value={f.wallPaint} presets={PAINTS} onChange={(wallPaint) => set({ wallPaint })} />

      <h4>Appliances</h4>
      <section className="field">
        <h3>Appliance finish</h3>
        <div className="swatches">
          {APPLIANCE_FINISHES.map((a) => (
            <button
              key={a.id}
              title={a.name}
              className={a.id === f.appliance ? 'swatch on' : 'swatch'}
              style={{ background: a.id.includes('stainless') || a.id === 'slate' ? `linear-gradient(135deg, ${a.hex}, #fff8 50%, ${a.hex})` : a.hex }}
              onClick={() => set({ appliance: a.id })}
            />
          ))}
        </div>
        <span className="muted">{APPLIANCE_FINISHES.find((a) => a.id === f.appliance)?.name}</span>
      </section>
    </aside>
  );
}
