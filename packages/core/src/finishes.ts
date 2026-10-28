/** Wood and stain catalog. Ids are stored in documents; names are shown in the UI. */

export const WOOD_SPECIES = [
  { id: 'maple', name: 'Maple' },
  { id: 'red-oak', name: 'Red oak' },
  { id: 'white-oak', name: 'White oak' },
  { id: 'walnut', name: 'Walnut' },
  { id: 'cherry', name: 'Cherry' },
  { id: 'pine', name: 'Knotty pine' },
  { id: 'hickory', name: 'Hickory' },
  { id: 'ash', name: 'Ash' },
  { id: 'birch', name: 'Birch' },
  { id: 'alder', name: 'Alder' },
] as const;

export type WoodSpeciesId = (typeof WOOD_SPECIES)[number]['id'];

export interface Stain {
  id: string;
  name: string;
  /**
   * `multiply` darkens and tints like a penetrating stain; `wash` blends towards a pigment
   * colour like a pickling or whitewash finish. `rgb` and `strength` (0..1) drive the render.
   */
  mode: 'none' | 'multiply' | 'wash';
  rgb: [number, number, number];
  strength: number;
}

export const STAINS: readonly Stain[] = [
  { id: 'natural', name: 'Natural', mode: 'none', rgb: [255, 255, 255], strength: 0 },
  { id: 'honey', name: 'Honey', mode: 'multiply', rgb: [255, 212, 150], strength: 0.5 },
  { id: 'golden-oak', name: 'Golden oak', mode: 'multiply', rgb: [232, 168, 88], strength: 0.6 },
  { id: 'early-american', name: 'Early American', mode: 'multiply', rgb: [172, 112, 62], strength: 0.7 },
  { id: 'provincial', name: 'Provincial', mode: 'multiply', rgb: [140, 92, 56], strength: 0.78 },
  { id: 'red-mahogany', name: 'Red mahogany', mode: 'multiply', rgb: [156, 62, 42], strength: 0.72 },
  { id: 'dark-walnut', name: 'Dark walnut', mode: 'multiply', rgb: [96, 62, 42], strength: 0.82 },
  { id: 'espresso', name: 'Espresso', mode: 'multiply', rgb: [58, 40, 31], strength: 0.9 },
  { id: 'ebony', name: 'Ebony', mode: 'multiply', rgb: [36, 31, 29], strength: 0.93 },
  { id: 'weathered-gray', name: 'Weathered grey', mode: 'wash', rgb: [150, 148, 140], strength: 0.5 },
  { id: 'white-wash', name: 'Whitewash', mode: 'wash', rgb: [240, 236, 226], strength: 0.55 },
];

export type CabinetSurface =
  | { type: 'paint'; hex: string }
  | { type: 'wood'; species: WoodSpeciesId; stain: string };
