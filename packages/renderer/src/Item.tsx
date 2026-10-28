import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  STANDARD,
  catalogItem,
  inches,
  itemSize,
  sinkOptions,
  toMetres as m,
  type CabinetSpec,
  type Finishes,
  type FurnitureType,
  type PlacedItem,
} from '@hearth/core';
import { Appliance, WallOvenFront } from './appliances';
import { Cabinet, Part, surfaceMaterial, type CabinetFinish } from './Cabinet';
import { applianceMaterials } from './surfaces';

const furnitureWood = () => surfaceMaterial({ type: 'wood', species: 'walnut', stain: 'natural' });
const blackMetal = new THREE.MeshPhysicalMaterial({ color: '#1d1d1d', metalness: 0.7, roughness: 0.45 });
const selectionMat = new THREE.LineBasicMaterial({ color: '#e0692f', depthTest: false, transparent: true });

function Furniture({ type, w, d, h }: { type: FurnitureType; w: number; d: number; h: number }) {
  const wood = furnitureWood();
  switch (type) {
    case 'stool': {
      const r = w / 2 - 0.02;
      return (
        <group position={[w / 2, 0, d / 2]}>
          <mesh position={[0, h - 0.02, 0]} material={wood} castShadow receiveShadow>
            <cylinderGeometry args={[r, r - 0.01, 0.04, 40]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            return (
              <mesh key={i} position={[Math.cos(a) * r * 0.75, (h - 0.04) / 2, Math.sin(a) * r * 0.75]} rotation={[Math.sin(a) * 0.06, 0, -Math.cos(a) * 0.06]} material={blackMetal} castShadow>
                <cylinderGeometry args={[0.012, 0.012, h - 0.04, 12]} />
              </mesh>
            );
          })}
          <mesh position={[0, h * 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} material={blackMetal} castShadow>
            <torusGeometry args={[r * 0.8, 0.008, 8, 40]} />
          </mesh>
        </group>
      );
    }
    case 'chair': {
      const seat = 0.46;
      return (
        <group>
          <Part size={[w, 0.03, d - 0.02]} position={[w / 2, seat, d / 2 + 0.01]} grain="y" material={wood} />
          {[
            [0.03, 0.03],
            [w - 0.03, 0.03],
            [0.03, d - 0.03],
            [w - 0.03, d - 0.03],
          ].map(([x, z], i) => (
            <Part key={i} size={[0.035, i < 2 ? h : seat, 0.035]} position={[x!, (i < 2 ? h : seat) / 2, z!]} grain="y" material={wood} radius={0.004} />
          ))}
          {[0.62, 0.72, 0.82].map((y) => (
            <Part key={y} size={[w - 0.06, 0.05, 0.02]} position={[w / 2, y, 0.03]} grain="x" material={wood} />
          ))}
        </group>
      );
    }
    case 'table-rect':
      return (
        <group>
          <Part size={[w, 0.035, d]} position={[w / 2, h - 0.0175, d / 2]} grain="x" material={wood} radius={0.004} />
          {[
            [0.06, 0.06],
            [w - 0.06, 0.06],
            [0.06, d - 0.06],
            [w - 0.06, d - 0.06],
          ].map(([x, z], i) => (
            <Part key={i} size={[0.065, h - 0.035, 0.065]} position={[x!, (h - 0.035) / 2, z!]} grain="y" material={wood} radius={0.003} />
          ))}
        </group>
      );
    case 'table-round':
      return (
        <group position={[w / 2, 0, d / 2]}>
          <mesh position={[0, h - 0.0175, 0]} material={wood} castShadow receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2, 0.035, 64]} />
          </mesh>
          <mesh position={[0, (h - 0.035) / 2, 0]} material={wood} castShadow>
            <cylinderGeometry args={[0.06, 0.08, h - 0.035, 24]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={wood} castShadow receiveShadow>
            <cylinderGeometry args={[0.25, 0.27, 0.04, 40]} />
          </mesh>
        </group>
      );
  }
}

export interface ItemProps {
  item: PlacedItem;
  finishes: Finishes;
  ceilingHeight: number;
  selected?: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}

/** One placed catalog item, positioned from its plan centre and rotation. */
export function Item({ item, finishes, ceilingHeight, selected, onPointerDown }: ItemProps) {
  const c = catalogItem(item.catalogId);
  const size = itemSize(item);
  const w = m(size.width), d = m(size.depth), h = m(size.height);
  const cabinetFinish: CabinetFinish = {
    surface: finishes.cabinet,
    hardwareStyle: finishes.hardwareStyle,
    hardwareFinish: finishes.hardwareFinish,
  };
  const mats = applianceMaterials(finishes.appliance);
  const outline = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.01, h + 0.01, d + 0.01)), [w, h, d]);

  let body: React.ReactNode = null;
  const r = c.render;
  if (r.type === 'cabinet') {
    const spec: CabinetSpec = {
      kind: r.kind,
      system: finishes.system,
      width: size.width,
      height: size.height,
      depth: size.depth,
      // Farmhouse sinks replace the false front with their own apron.
      front: r.sink && sinkOptions(item).style === 'farmhouse' ? { type: 'sink', apron: inches(10) } : r.front,
      doorStyle: finishes.doorStyle,
    };
    body = <Cabinet spec={spec} finish={cabinetFinish} />;
  } else if (r.type === 'appliance' && r.appliance === 'wall-oven') {
    // Tall oven cabinet: drawers below, oven in the middle, doors above.
    const lowerH = inches(30), ovenH = inches(29);
    const base = (kind: 'base' | 'wall', height: number, front: CabinetSpec['front']): CabinetSpec => ({
      kind, system: finishes.system, width: size.width, height, depth: size.depth, front, doorStyle: finishes.doorStyle,
    });
    body = (
      <group>
        <Cabinet spec={base('base', lowerH, { type: 'drawers', count: 2 })} finish={cabinetFinish} />
        <group position={[0, m(lowerH), 0]}>
          <Part size={[w, m(ovenH), d - 0.02]} position={[w / 2, m(ovenH) / 2, (d - 0.02) / 2]} grain="y" material={surfaceMaterial(finishes.cabinet)} radius={0} />
          <group position={[0.01, 0, d - 0.02]}>
            <WallOvenFront w={w - 0.02} h={m(ovenH)} mats={mats} />
          </group>
        </group>
        <group position={[0, m(lowerH + ovenH), 0]}>
          <Cabinet spec={base('wall', size.height - lowerH - ovenH, { type: 'doors' })} finish={cabinetFinish} />
        </group>
      </group>
    );
  } else if (r.type === 'appliance') {
    body = (
      <Appliance type={r.appliance} w={w} d={d} h={h} mats={mats} fuel={r.fuel} slideIn={r.slideIn} toCeiling={m(ceilingHeight - item.position.z)} />
    );
  } else {
    body = <Furniture type={r.furniture} w={w} d={d} h={h} />;
  }

  return (
    <group
      position={[m(item.position.x), m(item.position.z), m(item.position.y)]}
      rotation={[0, -item.rotation, 0]}
      onPointerDown={onPointerDown}
      userData={{ itemId: item.id }}
    >
      <group position={[-w / 2, 0, -d / 2]}>{body}</group>
      {/* The outline ignores the pointer: lines are hit-tested with a wide tolerance. */}
      {selected && <lineSegments geometry={outline} material={selectionMat} position={[0, h / 2, 0]} renderOrder={10} raycast={() => null} />}
    </group>
  );
}

/** Base cabinets get their countertop from <CounterRuns>; this is the shared counter height. */
export const COUNTER_BOTTOM = STANDARD.base.height;
