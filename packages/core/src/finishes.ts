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

export const FLOORING = [
  { id: 'wood:white-oak:natural', name: 'White oak plank' },
  { id: 'wood:white-oak:provincial', name: 'Stained oak plank' },
  { id: 'wood:walnut:natural', name: 'Walnut plank' },
  { id: 'wood:maple:natural', name: 'Maple plank' },
  { id: 'wood:hickory:natural', name: 'Hickory plank' },
  { id: 'wood:white-oak:weathered-gray', name: 'Grey-washed oak' },
  { id: 'tile:porcelain-light', name: 'Light porcelain 24×24' },
  { id: 'tile:porcelain-grey', name: 'Concrete-look porcelain 24×24' },
  { id: 'tile:checker', name: 'Black & white checker 12×12' },
  { id: 'tile:terracotta', name: 'Terracotta 12×12' },
] as const;

export const COUNTERTOPS = [
  { id: 'quartz-white', name: 'White quartz' },
  { id: 'calacatta', name: 'Calacatta quartz' },
  { id: 'carrara', name: 'Carrara marble' },
  { id: 'black-granite', name: 'Absolute black granite' },
  { id: 'soapstone', name: 'Soapstone' },
  { id: 'concrete', name: 'Concrete' },
  { id: 'butcher-maple', name: 'Maple butcher block' },
  { id: 'butcher-walnut', name: 'Walnut butcher block' },
] as const;

export const APPLIANCE_FINISHES = [
  { id: 'stainless', name: 'Stainless steel', hex: '#c8c9cb' },
  { id: 'black-stainless', name: 'Black stainless', hex: '#3d3b3a' },
  { id: 'white', name: 'White', hex: '#f2f2f0' },
  { id: 'black', name: 'Black', hex: '#1b1b1b' },
  { id: 'slate', name: 'Slate', hex: '#6a6763' },
] as const;

export type FlooringId = (typeof FLOORING)[number]['id'];
export type CountertopId = (typeof COUNTERTOPS)[number]['id'];
export type ApplianceFinishId = (typeof APPLIANCE_FINISHES)[number]['id'];

export const BACKSPLASH_STYLES = [
  { id: 'subway', name: 'Subway 3×6' },
  { id: 'subway-stacked', name: 'Stacked vertical 2×8' },
  { id: 'herringbone', name: 'Herringbone 2×8' },
  { id: 'square', name: 'Square 4×4' },
  { id: 'large-format', name: 'Large format 12×24' },
  { id: 'slab', name: 'Countertop slab' },
  { id: 'none', name: 'None (paint)' },
] as const;

export type BacksplashStyleId = (typeof BACKSPLASH_STYLES)[number]['id'];

export const TILE_COLOURS = [
  { name: 'White', hex: '#F3F1EC' },
  { name: 'Cream', hex: '#EDE3CF' },
  { name: 'Sage', hex: '#A9B39A' },
  { name: 'Sky', hex: '#A9C1CF' },
  { name: 'Navy', hex: '#2F3E55' },
  { name: 'Charcoal', hex: '#3C3C3C' },
  { name: 'Terracotta', hex: '#B5674A' },
] as const;
