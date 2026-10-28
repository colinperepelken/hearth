import { create } from 'zustand';
import { inches, type CabinetSystem, type DoorStyle, type UnitSystem } from '@hearth/core';
import type { HardwareFinish, HardwareStyle } from '@hearth/renderer';

export type ViewMode = 'orbit' | 'walk' | 'photo';

interface AppState {
  mode: ViewMode;
  units: UnitSystem;
  /** Walk-mode eye height, mm. */
  eyeHeight: number;
  samples: number;
  cabinetColor: string;
  wallColor: string;
  doorStyle: DoorStyle;
  system: CabinetSystem;
  hardwareStyle: HardwareStyle;
  hardwareFinish: HardwareFinish;
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
}

export const useApp = create<AppState>((set) => ({
  mode: 'orbit',
  units: 'imperial',
  eyeHeight: inches(64),
  samples: 0,
  cabinetColor: '#ADAE8F',
  wallColor: '#F0EEE4',
  doorStyle: 'shaker',
  system: 'frameless',
  hardwareStyle: 'bar',
  hardwareFinish: 'brass',
  set: (patch) => set(patch),
}));

/** Approximate on-screen values; physical chips vary. Full paint libraries come with the catalog package. */
export const PAINTS = [
  { name: 'Chantilly Lace', code: 'BM OC-65', hex: '#F4F4EE' },
  { name: 'Simply White', code: 'BM OC-117', hex: '#F0EEE4' },
  { name: 'Revere Pewter', code: 'BM HC-172', hex: '#CBC3B3' },
  { name: 'Saybrook Sage', code: 'BM HC-114', hex: '#ADAE8F' },
  { name: 'Chelsea Gray', code: 'BM HC-168', hex: '#8A8A84' },
  { name: 'Hale Navy', code: 'BM HC-154', hex: '#434B56' },
  { name: 'Wrought Iron', code: 'BM 2124-10', hex: '#4B4D4F' },
] as const;
