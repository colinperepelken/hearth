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
  createdAt: string;
  updatedAt: string;
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
  underlay?: { src: string; mmPerPixel: number; origin: Vec2; rotation: number; opacity: number };
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
  /** Catalog entry, e.g. `cabinet.base.drawer-door` or `appliance.range.ge-jgb735`. */
  catalogId: string;
  position: { x: Mm; y: Mm; z: Mm };
  /** Rotation about the vertical axis, radians. */
  rotation: number;
  /** Per-item options: size, door style, hinge side, finish overrides… */
  options: Record<string, unknown>;
}
