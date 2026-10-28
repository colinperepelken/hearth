import { useEffect, useState } from 'react';
import { formatLength, parseLength, type Mm, type UnitSystem } from '@hearth/core';

/** Text field for a length: accepts `3' 6"`, `42 1/2`, `1067mm`…, applies on Enter or blur. */
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
  return (
    <input
      className="length"
      value={draft}
      spellCheck={false}
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
        e.stopPropagation();
      }}
    />
  );
}
