import { describe, expect, it } from 'vitest';
import { lShapeWalls, moveWall, rectangleWalls, setWallLength, wallInwardNormal, wallLength } from './geometry';
import type { PlacedItem, Room } from './model';
import { snapItem } from './snap';

const room = (walls = rectangleWalls(4000, 3000, 2400)): Room => ({ id: 'r', name: 'Kitchen', type: 'kitchen', walls, surfaces: {}, items: [] });

describe('room editing', () => {
  it('points wall normals into the room', () => {
    const r = room();
    expect(wallInwardNormal(r, 0)).toEqual({ x: -0, y: 1 }); // top wall faces down the screen
    expect(wallInwardNormal(r, 1).x).toBeCloseTo(-1);
  });

  it('setWallLength keeps a rectangle square', () => {
    const r = room();
    setWallLength(r, 0, 5000);
    expect(wallLength(r.walls[0]!)).toBeCloseTo(5000);
    expect(wallLength(r.walls[2]!)).toBeCloseTo(5000);
    expect(wallLength(r.walls[1]!)).toBeCloseTo(3000);
  });

  it('moveWall outward stretches neighbours', () => {
    const r = room();
    moveWall(r, 1, 500); // right wall out by 500
    expect(wallLength(r.walls[0]!)).toBeCloseTo(4500);
    expect(wallLength(r.walls[2]!)).toBeCloseTo(4500);
    expect(wallLength(r.walls[1]!)).toBeCloseTo(3000);
  });

  it('moves an inner wall of an L-shape', () => {
    const r = room(lShapeWalls(4000, 3000, 1000, 1000, 2400));
    moveWall(r, 2, 200);
    expect(wallLength(r.walls[1]!)).toBeCloseTo(2200);
    expect(wallLength(r.walls[3]!)).toBeCloseTo(800);
  });
});

describe('snapItem', () => {
  const base = (id: string, x: number): PlacedItem => ({ id, catalogId: 'cab.base', position: { x, y: 305, z: 0 }, rotation: 0, options: {} });

  it('pushes a base cabinet against the nearest wall, facing into the room', () => {
    const r = room();
    const s = snapItem(r, [], base('a', 0), { x: 1500, y: 500 });
    expect(s.wall).toBe(0);
    expect(s.y).toBeCloseTo(304.8); // half of 24" deep
    expect(s.rotation).toBeCloseTo(0);
  });

  it('butts up against a neighbour', () => {
    const r = room();
    const left = base('a', 381); // 30" wide, against the left wall
    const s = snapItem(r, [left], base('b', 0), { x: 381 + 762 + 40, y: 400 });
    expect(s.x).toBeCloseTo(381 + 762);
  });
});
