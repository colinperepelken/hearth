import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { bounds, catalogItem, itemSize, pointInPolygon, roomVertices, toMetres as m, type PlacedItem, type Room } from '@hearth/core';

RectAreaLightUniformsLib.init();

const MAX_UNDER_CABINET = 10;

/** Sun through the windows, a grid of recessed pot lights, and LED strips under wall cabinets. */
export function RoomLights({ room, height, items }: { room: Room; height: number; items: PlacedItem[] }) {
  const verts = roomVertices(room);
  const b = bounds(verts);
  const cx = m((b.minX + b.maxX) / 2), cz = m((b.minY + b.maxY) / 2);
  const span = m(Math.max(b.maxX - b.minX, b.maxY - b.minY));

  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff3e0', 4.5);
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.02;
    return l;
  }, []);
  useEffect(() => {
    // Late-morning sun from up and behind the top (north) wall.
    sun.position.set(cx + span * 0.6, m(height) + span * 0.9, cz - span * 1.2);
    sun.target.position.set(cx, 0, cz);
    const r = span * 1.2;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: span * 4 });
    sun.shadow.camera.updateProjectionMatrix();
  }, [sun, cx, cz, span, height]);
  useEffect(() => () => sun.dispose(), [sun]);

  // Pot lights on a ~1.3 m grid, kept inside the room outline.
  const pots: [number, number][] = [];
  const step = 1300;
  const nx = Math.max(1, Math.round((b.maxX - b.minX) / step)), ny = Math.max(1, Math.round((b.maxY - b.minY) / step));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const p = { x: b.minX + ((i + 0.5) * (b.maxX - b.minX)) / nx, y: b.minY + ((j + 0.5) * (b.maxY - b.minY)) / ny };
      if (pointInPolygon(p, verts)) pots.push([m(p.x), m(p.y)]);
    }
  }

  const strips = items
    .filter((i) => {
      const c = catalogItem(i.catalogId);
      return c.render.type === 'cabinet' && c.render.kind === 'wall' && i.position.z < 1600;
    })
    .slice(0, MAX_UNDER_CABINET);

  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
      {pots.map(([x, z]) => (
        <group key={`${x},${z}`}>
          <spotLight position={[x, m(height) - 0.02, z]} angle={1.0} penumbra={1} intensity={9} decay={2} color="#fff1dd" target-position={[x, 0, z]} />
          <mesh position={[x, m(height) - 0.002, z]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.06, 32]} />
            <meshStandardMaterial color="#fff" emissive="#fff1dd" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}
      {strips.map((it) => {
        const { width, depth } = itemSize(it);
        // Strip near the front underside of the cabinet, facing down.
        const local = { x: 0, y: depth / 2 - 60 };
        const c = Math.cos(it.rotation), s = Math.sin(it.rotation);
        const px = it.position.x + local.x * c - local.y * s, py = it.position.y + local.x * s + local.y * c;
        return (
          <rectAreaLight
            key={it.id}
            position={[m(px), m(it.position.z) - 0.01, m(py)]}
            rotation={[-Math.PI / 2, -it.rotation, 0, 'YXZ']}
            width={m(width) - 0.05}
            height={0.03}
            intensity={25}
            color="#ffe9cc"
          />
        );
      })}
    </>
  );
}
