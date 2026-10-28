import {
  SCHEMA_VERSION,
  addOpening,
  catalogItem,
  feet,
  inches,
  newId,
  placeOnWall,
  rectangleWalls,
  type PlacedItem,
  type Project,
  type Room,
} from '@hearth/core';

/** A 12' x 11' starter kitchen so the app opens on something to look at. */
export function defaultProject(): Project {
  const height = feet(8);
  const room: Room = { id: newId('room'), name: 'Kitchen', type: 'kitchen', walls: rectangleWalls(feet(12), feet(11), height), surfaces: {}, items: [] };

  const win = addOpening(room, 0, 'window');
  win.width = inches(28);
  win.offset = inches(66 - 14);
  const door = addOpening(room, 3, 'door');
  door.offset = inches(20);

  const put = (catalogId: string, wall: number, offsetIn: number, width?: number) => {
    const c = catalogItem(catalogId);
    const w = width ? inches(width) : c.width;
    const p = placeOnWall(room, wall, w, c.depth, inches(offsetIn));
    const item: PlacedItem = { id: newId('item'), catalogId, position: { x: p.x, y: p.y, z: c.elevation }, rotation: p.rotation, options: width ? { width: w } : {} };
    room.items.push(item);
  };

  // Back wall: drawers, base, sink under the window, dishwasher, range (6" left for a filler).
  put('cab.base-drawers', 0, 0, 18);
  put('cab.base', 0, 18, 30);
  put('cab.sink-base', 0, 48, 36);
  put('app.dw.shx78cm5n', 0, 84);
  put('app.range.nx60a6511ss', 0, 108);
  put('cab.wall', 0, 0, 18);
  put('cab.wall', 0, 18, 30);
  put('cab.wall', 0, 84, 24);
  put('app.otr.ywmh31017hs', 0, 108);
  // Right wall: fridge with a cabinet above, then a pantry.
  put('app.fridge.rf28t5001sr', 1, 40);
  put('cab.wall-fridge', 1, 40, 36);
  put('cab.tall-pantry', 1, 76, 24);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('proj'),
    name: 'My kitchen',
    units: 'imperial',
    building: { levels: [{ id: newId('level'), name: 'Main floor', elevation: 0, ceilingHeight: height, rooms: [room] }] },
    finishes: {
      cabinet: { type: 'paint', hex: '#ADAE8F' },
      doorStyle: 'shaker',
      system: 'frameless',
      hardwareStyle: 'bar',
      hardwareFinish: 'brass',
      wallPaint: '#F0EEE4',
      floor: 'wood:white-oak:natural',
      countertop: 'quartz-white',
      appliance: 'stainless',
      backsplash: { style: 'subway', color: '#F3F1EC' },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
