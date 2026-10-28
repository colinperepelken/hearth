import type { CabinetSystem, DoorStyle } from './cabinets';
import type { ApplianceFinishId, BacksplashStyleId, CabinetSurface, CountertopId, FlooringId } from './finishes';
import type { Mm } from './units';

/**
 * The persisted document. Kitchen is one RoomType; other room types plug into the same tree.
 * Bump SCHEMA_VERSION and add a migration whenever the shape changes.
 */
export const SCHEMA_VERSION = 1;

export type Id = string;

export interface Vec2 {
  x: Mm;
  y: Mm;
}

export interface Project {
  schemaVersion: number;
  id: Id;
  name: string;
  units: 'imperial' | 'metric';
  building: Building;
  finishes: Finishes;
  createdAt: string;
  updatedAt: string;
}

/** Project-wide finish choices. Per-item overrides can come later via PlacedItem.options. */
export interface Finishes {
  cabinet: CabinetSurface;
  doorStyle: DoorStyle;
  system: CabinetSystem;
  hardwareStyle: 'bar' | 'knob' | 'cup';
  hardwareFinish: 'brass' | 'black' | 'nickel';
  wallPaint: string;
  floor: FlooringId;
  countertop: CountertopId;
  appliance: ApplianceFinishId;
  backsplash: { style: BacksplashStyleId; color: string };
}

export interface Building {
  levels: Level[];
}

export interface Level {
  id: Id;
  name: string;
  elevation: Mm;
  ceilingHeight: Mm;
  rooms: Room[];
  /** Optional traced floorplan image, with its calibrated scale. */
  underlay?: Underlay;
}

/** A floorplan image traced under the plan. `origin` is the image's top-left corner in plan mm. */
export interface Underlay {
  src: string;
  pixelWidth: number;
  pixelHeight: number;
  mmPerPixel: number;
  origin: Vec2;
  opacity: number;
}

export type RoomType = 'kitchen' | 'bathroom' | 'bedroom' | 'living' | 'dining' | 'other';

export interface Room {
  id: Id;
  name: string;
  type: RoomType;
  walls: Wall[];
  surfaces: { floor?: FinishRef; ceiling?: FinishRef };
  items: PlacedItem[];
}

export interface Wall {
  id: Id;
  start: Vec2;
  end: Vec2;
  thickness: Mm;
  height: Mm;
  /** Finish on the room-facing side. */
  finish?: FinishRef;
  openings: Opening[];
}

export interface Opening {
  id: Id;
  kind: 'door' | 'window' | 'passthrough';
  /** Distance along the wall from `start` to the opening's left edge. */
  offset: Mm;
  width: Mm;
  height: Mm;
  sillHeight: Mm;
}

/** A reference into the finish catalog, or a custom colour. */
export type FinishRef = { catalogId: string } | { paintHex: string; paintName?: string };

export interface PlacedItem {
  id: Id;
  /** Catalog entry id, e.g. `cab.base` or `app.range.nx60a6511ss`. */
  catalogId: string;
  /** Plan centre of the footprint (x, y) and height of the underside above the floor (z). */
  position: { x: Mm; y: Mm; z: Mm };
  /**
   * Plan rotation, radians. At 0 the item's front faces +y (down the screen);
   * the 3D scene uses rotation.y = -rotation.
   */
  rotation: number;
  /** Per-item options: `width`, `height` (mm) overrides and future finish overrides. */
  options: { width?: Mm; height?: Mm; [k: string]: unknown };
}
