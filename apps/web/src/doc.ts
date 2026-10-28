import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import {
  SCHEMA_VERSION,
  catalogItem,
  inches,
  newId,
  snapItem,
  type Level,
  type PlacedItem,
  type Project,
  type Room,
  type UnitSystem,
  type Vec2,
} from '@hearth/core';
import { defaultProject } from './defaultProject';

export type Step = 'room' | 'design' | 'finishes';
export type ViewMode = 'orbit' | 'walk' | 'photo';
export type Layout = '3d' | 'plan' | 'split';

export type Selection =
  | { kind: 'item'; id: string }
  | { kind: 'wall'; index: number }
  | { kind: 'opening'; wall: number; id: string }
  | null;

/** Two clicked plan points while calibrating the floorplan image's scale. */
export interface Calibration {
  points: Vec2[];
}

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  selection: Selection;
  step: Step;
  layout: Layout;
  mode: ViewMode;
  eyeHeight: number;
  samples: number;
  dragging: boolean;
  calibration: Calibration | null;
  moveUnderlay: boolean;
  loaded: boolean;

  /** Applies a change to a copy of the project. `history: false` skips the undo stack (mid-drag). */
  edit: (fn: (p: Project) => void, opts?: { history?: boolean }) => void;
  /** Records the current project on the undo stack, e.g. at the start of a drag. */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  select: (s: Selection) => void;
  set: (patch: Partial<Pick<State, 'step' | 'layout' | 'mode' | 'eyeHeight' | 'samples' | 'dragging' | 'calibration' | 'moveUnderlay'>>) => void;
  addItem: (catalogId: string, at?: Vec2) => void;
  deleteSelection: () => void;
}

const MAX_HISTORY = 100;

export const level = (p: Project): Level => p.building.levels[0]!;
export const room = (p: Project): Room => level(p).rooms[0]!;

export const useHearth = create<State>((set, get) => ({
  project: defaultProject(),
  past: [],
  future: [],
  selection: null,
  step: 'design',
  layout: '3d',
  mode: 'orbit',
  eyeHeight: inches(64),
  samples: 0,
  dragging: false,
  calibration: null,
  moveUnderlay: false,
  loaded: false,

  edit: (fn, opts) => {
    const { project, past } = get();
    const next = structuredClone(project);
    fn(next);
    next.updatedAt = new Date().toISOString();
    if (opts?.history === false) set({ project: next });
    else set({ project: next, past: [...past, project].slice(-MAX_HISTORY), future: [] });
  },
  checkpoint: () => {
    const { project, past } = get();
    set({ past: [...past, project].slice(-MAX_HISTORY), future: [] });
  },
  undo: () => {
    const { past, project, future } = get();
    const prev = past.at(-1);
    if (prev) set({ project: prev, past: past.slice(0, -1), future: [project, ...future], selection: null });
  },
  redo: () => {
    const { past, project, future } = get();
    const next = future[0];
    if (next) set({ project: next, past: [...past, project], future: future.slice(1), selection: null });
  },
  select: (selection) => set({ selection }),
  set: (patch) => set(patch),

  addItem: (catalogId, at) => {
    const c = catalogItem(catalogId);
    const r = room(get().project);
    const xs = r.walls.map((w) => w.start.x), ys = r.walls.map((w) => w.start.y);
    const centre = at ?? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const item: PlacedItem = { id: newId('item'), catalogId, position: { x: centre.x, y: centre.y, z: c.elevation }, rotation: 0, options: {} };
    const s = snapItem(r, r.items, item, centre);
    item.position.x = s.x;
    item.position.y = s.y;
    item.rotation = s.rotation;
    get().edit((p) => room(p).items.push(item));
    set({ selection: { kind: 'item', id: item.id } });
  },

  deleteSelection: () => {
    const s = get().selection;
    if (!s) return;
    if (s.kind === 'item') get().edit((p) => void (room(p).items = room(p).items.filter((i) => i.id !== s.id)));
    if (s.kind === 'opening') get().edit((p) => {
      const w = room(p).walls[s.wall];
      if (w) w.openings = w.openings.filter((o) => o.id !== s.id);
    });
    set({ selection: null });
  },
}));

export const units = (p: Project): UnitSystem => p.units;

// Autosave to IndexedDB (debounced). Images in the floorplan underlay can be large, which
// rules out localStorage.
const KEY = 'hearth:project';
let timer: ReturnType<typeof setTimeout> | undefined;

export async function loadSaved() {
  try {
    const saved = (await idbGet(KEY)) as Project | undefined;
    if (saved && saved.schemaVersion === SCHEMA_VERSION && saved.finishes?.backsplash) {
      useHearth.setState({ project: saved });
    }
  } catch {
    // Storage unavailable: start from the default project.
  }
  useHearth.setState({ loaded: true });
  useHearth.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(() => idbSet(KEY, s.project).catch(() => {}), 400);
  });
}

export function resetProject() {
  useHearth.setState({ project: defaultProject(), past: [], future: [], selection: null });
}

/** Approximate on-screen values of the named chips. */
export const PAINTS = [
  { name: 'Chantilly Lace', code: 'BM OC-65', hex: '#F4F4EE' },
  { name: 'Simply White', code: 'BM OC-117', hex: '#F0EEE4' },
  { name: 'Revere Pewter', code: 'BM HC-172', hex: '#CBC3B3' },
  { name: 'Saybrook Sage', code: 'BM HC-114', hex: '#ADAE8F' },
  { name: 'Chelsea Gray', code: 'BM HC-168', hex: '#8A8A84' },
  { name: 'Hale Navy', code: 'BM HC-154', hex: '#434B56' },
  { name: 'Wrought Iron', code: 'BM 2124-10', hex: '#4B4D4F' },
] as const;
