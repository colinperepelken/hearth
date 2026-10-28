import { STANDARD, type CabinetKind, type FrontLayout } from './cabinets';
import type { PlacedItem } from './model';
import { inches, type Mm } from './units';

export type ItemCategory = 'cabinets' | 'appliances' | 'furniture';

export type ApplianceType =
  | 'range'
  | 'fridge-french'
  | 'fridge-top-freezer'
  | 'dishwasher'
  | 'microwave-otr'
  | 'microwave-counter'
  | 'hood-chimney'
  | 'hood-under-cabinet'
  | 'wall-oven';

export type FurnitureType = 'stool' | 'table-rect' | 'table-round' | 'chair';

export type ItemRender =
  | { type: 'cabinet'; kind: CabinetKind; front: FrontLayout; sink?: boolean }
  | { type: 'appliance'; appliance: ApplianceType; fuel?: 'gas' | 'electric'; slideIn?: boolean }
  | { type: 'furniture'; furniture: FurnitureType };

export interface CatalogItem {
  id: string;
  name: string;
  category: ItemCategory;
  /** Sub-heading in the catalog panel. */
  group: string;
  width: Mm;
  depth: Mm;
  height: Mm;
  /** Default height of the item's underside above the floor. */
  elevation: Mm;
  /** `wall` items push back against the nearest wall; `free` items go anywhere. */
  snap: 'wall' | 'free';
  /** `supports`: a countertop sits on it. `under`: the countertop runs over it (dishwasher). */
  counter?: 'supports' | 'under';
  render: ItemRender;
  widths?: readonly Mm[];
  heights?: readonly Mm[];
  brand?: string;
  model?: string;
}

const B = STANDARD.base, W = STANDARD.wall, T = STANDARD.tall;
const doorDrawer: FrontLayout = { type: 'door-drawer', drawerHeight: inches(6) };

const cabinets: CatalogItem[] = [
  {
    id: 'cab.base', name: 'Base cabinet', category: 'cabinets', group: 'Base cabinets',
    width: inches(30), depth: B.depth, height: B.height, elevation: 0, snap: 'wall', counter: 'supports',
    render: { type: 'cabinet', kind: 'base', front: doorDrawer }, widths: B.widths,
  },
  {
    id: 'cab.base-drawers', name: 'Drawer base (3 drawers)', category: 'cabinets', group: 'Base cabinets',
    width: inches(18), depth: B.depth, height: B.height, elevation: 0, snap: 'wall', counter: 'supports',
    render: { type: 'cabinet', kind: 'base', front: { type: 'drawers', count: 3 } }, widths: B.widths.filter((w) => w >= inches(12)),
  },
  {
    id: 'cab.base-drawers-4', name: 'Drawer base (4 drawers)', category: 'cabinets', group: 'Base cabinets',
    width: inches(24), depth: B.depth, height: B.height, elevation: 0, snap: 'wall', counter: 'supports',
    render: { type: 'cabinet', kind: 'base', front: { type: 'drawers', count: 4 } }, widths: B.widths.filter((w) => w >= inches(12)),
  },
  {
    id: 'cab.base-doors', name: 'Base, full-height doors', category: 'cabinets', group: 'Base cabinets',
    width: inches(30), depth: B.depth, height: B.height, elevation: 0, snap: 'wall', counter: 'supports',
    render: { type: 'cabinet', kind: 'base', front: { type: 'doors' } }, widths: B.widths,
  },
  {
    id: 'cab.sink-base', name: 'Sink base', category: 'cabinets', group: 'Base cabinets',
    width: inches(36), depth: B.depth, height: B.height, elevation: 0, snap: 'wall', counter: 'supports',
    render: { type: 'cabinet', kind: 'base', front: { type: 'sink' }, sink: true }, widths: [30, 33, 36, 42].map(inches),
  },
  {
    id: 'cab.wall', name: 'Wall cabinet', category: 'cabinets', group: 'Wall cabinets',
    width: inches(30), depth: W.depth, height: inches(36), elevation: STANDARD.wallCabinetBottom, snap: 'wall',
    render: { type: 'cabinet', kind: 'wall', front: { type: 'doors' } }, widths: W.widths, heights: W.heights,
  },
  {
    id: 'cab.wall-fridge', name: 'Above-fridge cabinet (24" deep)', category: 'cabinets', group: 'Wall cabinets',
    width: inches(36), depth: inches(24), height: inches(15), elevation: inches(75), snap: 'wall',
    render: { type: 'cabinet', kind: 'wall', front: { type: 'doors' } }, widths: [30, 33, 36].map(inches), heights: [12, 15, 18, 24].map(inches),
  },
  {
    id: 'cab.tall-pantry', name: 'Pantry', category: 'cabinets', group: 'Tall cabinets',
    width: inches(24), depth: T.depth, height: inches(90), elevation: 0, snap: 'wall',
    render: { type: 'cabinet', kind: 'tall', front: { type: 'doors' } }, widths: T.widths, heights: T.heights,
  },
];

/**
 * Appliances sold in Canada. Dimensions are approximate (rounded from typical spec sheets);
 * check the manufacturer's installation guide before ordering cabinets.
 */
const appliances: CatalogItem[] = [
  // Ranges
  ...(
    [
      ['Samsung', 'NX60A6511SS', '30" gas range', 'gas', false, 29.9, 27.6, 46.7],
      ['LG', 'LREL6323S', '30" electric range', 'electric', false, 29.9, 28.4, 47.4],
      ['Frigidaire', 'FCRE3052BS', '30" electric range', 'electric', false, 29.9, 28.5, 47.1],
      ['Bosch', 'HGI8056UC', '30" gas slide-in range', 'gas', true, 30, 29.6, 36.6],
      ['Café', 'CGS700P2MS1', '30" gas slide-in range', 'gas', true, 29.9, 28.8, 36.6],
    ] as const
  ).map(([brand, model, name, fuel, slideIn, w, d, h]): CatalogItem => ({
    id: `app.range.${model.toLowerCase()}`, name, brand, model, category: 'appliances', group: 'Ranges',
    width: inches(w), depth: inches(d), height: inches(h), elevation: 0, snap: 'wall',
    render: { type: 'appliance', appliance: 'range', fuel, slideIn },
  })),
  // Refrigerators
  ...(
    [
      ['Samsung', 'RF28T5001SR', '36" French-door fridge', 'fridge-french', 35.75, 34.4, 70],
      ['LG', 'LRFXS2503S', '36" French-door fridge', 'fridge-french', 35.75, 33.75, 69.75],
      ['Bosch', 'B36CT80SNS', '36" counter-depth French-door', 'fridge-french', 35.6, 28.6, 70],
      ['Whirlpool', 'WRT518SZFM', '33" top-freezer fridge', 'fridge-top-freezer', 32.75, 33.9, 66.25],
      ['Frigidaire', 'FFTR1835VW', '30" top-freezer fridge', 'fridge-top-freezer', 29.75, 31.1, 66.3],
    ] as const
  ).map(([brand, model, name, appliance, w, d, h]): CatalogItem => ({
    id: `app.fridge.${model.toLowerCase()}`, name, brand, model, category: 'appliances', group: 'Refrigerators',
    width: inches(w), depth: inches(d), height: inches(h), elevation: 0, snap: 'wall',
    render: { type: 'appliance', appliance },
  })),
  // Dishwashers
  ...(
    [
      ['Bosch', 'SHX78CM5N', '24" dishwasher (800 Series)'],
      ['Bosch', 'SHP65CM5N', '24" dishwasher (500 Series)'],
      ['KitchenAid', 'KDTM404KPS', '24" dishwasher'],
      ['Miele', 'G5266SCVISF', '24" dishwasher'],
    ] as const
  ).map(([brand, model, name]): CatalogItem => ({
    id: `app.dw.${model.toLowerCase()}`, name, brand, model, category: 'appliances', group: 'Dishwashers',
    width: inches(23.6), depth: inches(23), height: inches(33.9), elevation: 0, snap: 'wall', counter: 'under',
    render: { type: 'appliance', appliance: 'dishwasher' },
  })),
  // Microwaves and hoods
  ...(
    [
      ['Whirlpool', 'YWMH31017HS', '30" over-the-range microwave/hood'],
      ['GE', 'JVM7195SKSS', '30" over-the-range microwave/hood'],
      ['Samsung', 'ME21R7051SS', '30" over-the-range microwave/hood'],
    ] as const
  ).map(([brand, model, name]): CatalogItem => ({
    id: `app.otr.${model.toLowerCase()}`, name, brand, model, category: 'appliances', group: 'Microwaves & hoods',
    width: inches(29.9), depth: inches(15.9), height: inches(16.4), elevation: inches(66), snap: 'wall',
    render: { type: 'appliance', appliance: 'microwave-otr' },
  })),
  {
    id: 'app.mw.panasonic-nn-sn686s', name: 'Countertop microwave', brand: 'Panasonic', model: 'NN-SN686S', category: 'appliances',
    group: 'Microwaves & hoods', width: inches(21.8), depth: inches(15.9), height: inches(12.9), elevation: inches(36), snap: 'wall',
    render: { type: 'appliance', appliance: 'microwave-counter' },
  },
  {
    id: 'app.hood.broan-bwp1304ss', name: '30" wall-mount chimney hood', brand: 'Broan', model: 'BWP1304SS', category: 'appliances',
    group: 'Microwaves & hoods', width: inches(30), depth: inches(18.5), height: inches(30), elevation: inches(66), snap: 'wall',
    render: { type: 'appliance', appliance: 'hood-chimney' },
  },
  {
    id: 'app.hood.broan-bcdf130ss', name: '30" under-cabinet hood', brand: 'Broan', model: 'BCDF130SS', category: 'appliances',
    group: 'Microwaves & hoods', width: inches(30), depth: inches(20), height: inches(6), elevation: inches(60), snap: 'wall',
    render: { type: 'appliance', appliance: 'hood-under-cabinet' },
  },
  {
    id: 'app.oven.whirlpool-wos51ec0hs', name: '30" single wall oven (in tall cabinet)', brand: 'Whirlpool', model: 'WOS51EC0HS',
    category: 'appliances', group: 'Wall ovens', width: inches(30), depth: T.depth, height: inches(90), elevation: 0, snap: 'wall',
    render: { type: 'appliance', appliance: 'wall-oven' },
  },
];

const furniture: CatalogItem[] = [
  {
    id: 'fur.stool-counter', name: 'Counter stool (26" seat)', category: 'furniture', group: 'Seating',
    width: inches(17), depth: inches(17), height: inches(26), elevation: 0, snap: 'free', render: { type: 'furniture', furniture: 'stool' },
  },
  {
    id: 'fur.stool-bar', name: 'Bar stool (30" seat)', category: 'furniture', group: 'Seating',
    width: inches(17), depth: inches(17), height: inches(30), elevation: 0, snap: 'free', render: { type: 'furniture', furniture: 'stool' },
  },
  {
    id: 'fur.chair', name: 'Dining chair', category: 'furniture', group: 'Seating',
    width: inches(18), depth: inches(20), height: inches(34), elevation: 0, snap: 'free', render: { type: 'furniture', furniture: 'chair' },
  },
  {
    id: 'fur.table-60', name: 'Dining table 60" x 36"', category: 'furniture', group: 'Tables',
    width: inches(60), depth: inches(36), height: inches(30), elevation: 0, snap: 'free', render: { type: 'furniture', furniture: 'table-rect' },
  },
  {
    id: 'fur.table-round-42', name: 'Round table 42"', category: 'furniture', group: 'Tables',
    width: inches(42), depth: inches(42), height: inches(30), elevation: 0, snap: 'free', render: { type: 'furniture', furniture: 'table-round' },
  },
];

export const CATALOG: readonly CatalogItem[] = [...cabinets, ...appliances, ...furniture];

const byId = new Map(CATALOG.map((c) => [c.id, c]));
export function catalogItem(id: string): CatalogItem {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown catalog item ${id}`);
  return c;
}

/** The item's size, honouring per-item width/height overrides. */
export function itemSize(item: PlacedItem): { width: Mm; depth: Mm; height: Mm } {
  const c = catalogItem(item.catalogId);
  return {
    width: (item.options.width as Mm | undefined) ?? c.width,
    depth: c.depth,
    height: (item.options.height as Mm | undefined) ?? c.height,
  };
}
