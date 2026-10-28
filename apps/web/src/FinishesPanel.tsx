import { useState } from 'react';
import { STAINS, WOOD_SPECIES, type WoodSpeciesId } from '@hearth/core';
import { woodSwatch } from '@hearth/renderer';
import { PAINTS, useApp } from './store';

const HEX = /^#[0-9a-f]{6}$/i;

function PaintPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  const match = PAINTS.find((p) => p.hex.toLowerCase() === value.toLowerCase());
  return (
    <section className="field">
      <h3>{label}</h3>
      <div className="swatches">
        {PAINTS.map((p) => (
          <button
            key={p.hex}
            title={`${p.name} (${p.code})`}
            className={p.hex.toLowerCase() === value.toLowerCase() ? 'swatch on' : 'swatch'}
            style={{ background: p.hex }}
            onClick={() => {
              onChange(p.hex);
              setDraft(p.hex);
            }}
          />
        ))}
      </div>
      <div className="hexrow">
        <input
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            if (HEX.test(e.target.value)) onChange(e.target.value);
          }}
        />
        <span className="muted">{match ? `${match.name} · ${match.code}` : 'Custom colour'}</span>
      </div>
    </section>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
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

function WoodPicker({
  species,
  stain,
  onChange,
}: {
  species: WoodSpeciesId;
  stain: string;
  onChange: (patch: { woodSpecies?: WoodSpeciesId; woodStain?: string }) => void;
}) {
  const speciesName = WOOD_SPECIES.find((w) => w.id === species)?.name;
  const stainName = STAINS.find((x) => x.id === stain)?.name;
  return (
    <>
      <section className="field">
        <h3>Wood</h3>
        <div className="swatches">
          {WOOD_SPECIES.map((w) => (
            <button
              key={w.id}
              title={w.name}
              className={w.id === species ? 'swatch on' : 'swatch'}
              style={{ backgroundImage: `url(${woodSwatch(w.id, 'natural')})` }}
              onClick={() => onChange({ woodSpecies: w.id })}
            />
          ))}
        </div>
        <span className="muted">{speciesName}</span>
      </section>
      <section className="field">
        <h3>Stain</h3>
        <div className="swatches">
          {STAINS.map((x) => (
            <button
              key={x.id}
              title={x.name}
              className={x.id === stain ? 'swatch on' : 'swatch'}
              style={{ backgroundImage: `url(${woodSwatch(species, x.id)})` }}
              onClick={() => onChange({ woodStain: x.id })}
            />
          ))}
        </div>
        <span className="muted">{stainName}</span>
      </section>
    </>
  );
}

export function FinishesPanel() {
  const s = useApp();
  return (
    <aside className="panel">
      <h2>Finishes</h2>
      <Segmented
        label="Cabinet finish"
        value={s.cabinetMaterial}
        options={[
          ['paint', 'Paint'],
          ['wood', 'Wood'],
        ]}
        onChange={(cabinetMaterial) => s.set({ cabinetMaterial })}
      />
      {s.cabinetMaterial === 'paint' ? (
        <PaintPicker label="Cabinet paint" value={s.cabinetColor} onChange={(cabinetColor) => s.set({ cabinetColor })} />
      ) : (
        <WoodPicker species={s.woodSpecies} stain={s.woodStain} onChange={(patch) => s.set(patch)} />
      )}
      <PaintPicker label="Wall paint" value={s.wallColor} onChange={(wallColor) => s.set({ wallColor })} />
      <Segmented
        label="Door style"
        value={s.doorStyle}
        options={[
          ['shaker', 'Shaker'],
          ['slab', 'Slab'],
          ['raised-panel', 'Raised'],
        ]}
        onChange={(doorStyle) => s.set({ doorStyle })}
      />
      <Segmented
        label="Construction"
        value={s.system}
        options={[
          ['frameless', 'Frameless'],
          ['framed', 'Framed'],
        ]}
        onChange={(system) => s.set({ system })}
      />
      <Segmented
        label="Hardware"
        value={s.hardwareStyle}
        options={[
          ['bar', 'Bar pull'],
          ['knob', 'Knob'],
          ['cup', 'Cup + knob'],
        ]}
        onChange={(hardwareStyle) => s.set({ hardwareStyle })}
      />
      <Segmented
        label="Hardware finish"
        value={s.hardwareFinish}
        options={[
          ['brass', 'Brass'],
          ['black', 'Matte black'],
          ['nickel', 'Nickel'],
        ]}
        onChange={(hardwareFinish) => s.set({ hardwareFinish })}
      />
    </aside>
  );
}
