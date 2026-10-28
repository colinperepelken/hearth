import { inches, type Mm } from './units';

export type CabinetSystem = 'framed' | 'frameless';
export type CabinetKind = 'base' | 'wall' | 'tall';
export type DoorStyle = 'shaker' | 'slab' | 'raised-panel';

/** How the front of a cabinet is divided, top to bottom. */
export type FrontLayout =
  | { type: 'door-drawer'; drawerHeight: Mm } // one drawer over door(s)
  | { type: 'drawers'; count: number }
  | { type: 'doors' }
  | { type: 'sink' }; // false drawer front over doors

export interface CabinetSpec {
  kind: CabinetKind;
  system: CabinetSystem;
  width: Mm;
  height: Mm;
  depth: Mm;
  front: FrontLayout;
  doorStyle: DoorStyle;
}

/** North American standard sizes. Heights exclude countertop; base height includes the toe kick. */
export const STANDARD = {
  base: {
    widths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 48].map(inches),
    height: inches(34.5),
    depth: inches(24),
  },
  wall: {
    widths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42].map(inches),
    heights: [12, 15, 18, 24, 30, 36, 42].map(inches),
    depth: inches(12),
  },
  tall: {
    widths: [18, 24, 30, 33].map(inches),
    heights: [84, 90, 96].map(inches),
    depth: inches(24),
  },
  toeKick: { height: inches(4.5), depth: inches(3) },
  countertop: { thickness: inches(1.5), overhang: inches(1) },
  /** Underside of wall cabinets above the floor (18" above a 36" counter). */
  wallCabinetBottom: inches(54),
} as const;

/** Metric (IKEA-style frameless) sizes, in mm. */
export const STANDARD_FRAMELESS = {
  base: { widths: [150, 200, 300, 400, 450, 600, 800], height: 800, depth: 600 },
  wall: { widths: [150, 200, 300, 400, 450, 600, 800], heights: [400, 600, 800, 1000], depth: 370 },
} as const;

/** Construction constants used by the renderer. */
export const CONSTRUCTION = {
  framed: { faceFrameStile: inches(1.5), faceFrameThickness: inches(0.75), reveal: inches(0.5) },
  frameless: { reveal: inches(0.125) },
  doorThickness: inches(0.75),
  shakerRail: inches(2.25),
  panelRecess: inches(0.25),
} as const;

/** Doors wider than this are split into a pair. */
export const MAX_SINGLE_DOOR_WIDTH = inches(24);
