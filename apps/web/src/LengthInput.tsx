import { useEffect, useState } from 'react';
import { formatLength, inches, parseLength, type Mm, type UnitSystem } from '@hearth/core';

/** Arrow-key step: 1" (10 mm); Shift for 1' (100 mm); Alt/Option for 1/8" (1 mm). */
function stepFor(units: UnitSystem, e: { shiftKey: boolean; altKey: boolean }): Mm {
  if (units === 'imperial') return e.shiftKey ? inches(12) : e.altKey ? inches(0.125) : inches(1);
  return e.shiftKey ? 100 : e.altKey ? 1 : 10;
}

/**
 * Text field for a length: accepts `3' 6"`, `42 1/2`, `1067mm`…, applies on Enter or blur.
 * Up/Down arrows (or the small buttons) nudge the value and apply it immediately.
 */
export function LengthInput({ value, units, onChange, min = 1 }: { value: Mm; units: UnitSystem; onChange: (mm: Mm) => void; min?: Mm }) {
  const [draft, setDraft] = useState(formatLength(value, units));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(formatLength(value, units));
  }, [value, units, focused]);
  const commit = () => {
    const mm = parseLength(draft, units);
    // Displayed values are rounded, so compare as displayed to avoid no-op edits.
    if (mm !== null && mm >= min) {
      if (formatLength(mm, units) !== formatLength(value, units)) onChange(mm);
    } else setDraft(formatLength(value, units));
  };
  const nudge = (dir: 1 | -1, e: { shiftKey: boolean; altKey: boolean }) => {
    const base = parseLength(draft, units) ?? value;
    const next = Math.max(min, base + dir * stepFor(units, e));
    setDraft(formatLength(next, units));
    onChange(next);
  };
  return (
    <span className="length-field">
      <input
        className="length"
        value={draft}
        spellCheck={false}
        title="↑/↓ to adjust · Shift for bigger steps · Option for finer"
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(formatLength(value, units));
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            nudge(e.key === 'ArrowUp' ? 1 : -1, e);
          }
          e.stopPropagation();
        }}
      />
      <span className="stepper-buttons">
        {([1, -1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            tabIndex={-1}
            aria-label={dir > 0 ? 'Increase' : 'Decrease'}
            onMouseDown={(e) => e.preventDefault()} // keep focus (and the draft) in the field
            onClick={(e) => nudge(dir, e)}
          >
            {dir > 0 ? '▴' : '▾'}
          </button>
        ))}
      </span>
    </span>
  );
}
