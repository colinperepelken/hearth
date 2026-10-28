import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  CONSTRUCTION,
  MAX_SINGLE_DOOR_WIDTH,
  STANDARD,
  inches,
  toMetres,
  type CabinetSpec,
  type DoorStyle,
} from '@hearth/core';

export type HardwareStyle = 'bar' | 'knob' | 'cup';
export type HardwareFinish = 'brass' | 'black' | 'nickel';

export interface CabinetFinish {
  color: string;
  hardwareStyle: HardwareStyle;
  hardwareFinish: HardwareFinish;
}

const m = toMetres;

interface Panel {
  x: number; // mm, from cabinet left
  y: number; // mm, from cabinet bottom
  w: number;
  h: number;
  kind: 'door' | 'drawer' | 'false-front';
  hinge?: 'left' | 'right';
}

/** Splits the cabinet front into door and drawer panels, in mm. */
function layoutFronts(spec: CabinetSpec): Panel[] {
  const reveal = spec.system === 'framed' ? CONSTRUCTION.framed.reveal : CONSTRUCTION.frameless.reveal;
  const bottom = spec.kind === 'base' ? STANDARD.toeKick.height : 0;
  const x0 = spec.system === 'framed' ? reveal : reveal / 2;
  const w = spec.width - x0 * 2;
  const top = spec.height - (spec.system === 'framed' ? reveal : reveal / 2);
  let y = bottom + (spec.system === 'framed' ? reveal : reveal / 2);
  const panels: Panel[] = [];

  const doors = (yFrom: number, yTo: number) => {
    const h = yTo - yFrom;
    if (w > MAX_SINGLE_DOOR_WIDTH) {
      const dw = (w - reveal) / 2;
      panels.push({ x: x0, y: yFrom, w: dw, h, kind: 'door', hinge: 'left' });
      panels.push({ x: x0 + dw + reveal, y: yFrom, w: dw, h, kind: 'door', hinge: 'right' });
    } else {
      panels.push({ x: x0, y: yFrom, w, h, kind: 'door', hinge: 'left' });
    }
  };

  switch (spec.front.type) {
    case 'doors':
      doors(y, top);
      break;
    case 'door-drawer':
    case 'sink': {
      const dh = spec.front.type === 'sink' ? inches(6) : spec.front.drawerHeight;
      panels.push({ x: x0, y: top - dh, w, h: dh, kind: spec.front.type === 'sink' ? 'false-front' : 'drawer' });
      doors(y, top - dh - reveal);
      break;
    }
    case 'drawers': {
      // Graduated: top drawer shallow, the rest share the remainder.
      const n = spec.front.count;
      const total = top - y - reveal * (n - 1);
      const first = n > 1 ? Math.min(inches(6), total / n) : total;
      const rest = n > 1 ? (total - first) / (n - 1) : 0;
      let yy = top;
      for (let i = 0; i < n; i++) {
        const h = i === 0 ? first : rest;
        panels.push({ x: x0, y: yy - h, w, h, kind: 'drawer' });
        yy -= h + reveal;
      }
      break;
    }
  }
  return panels;
}

function FrontPanel({ panel, style, material }: { panel: Panel; style: DoorStyle; material: THREE.Material }) {
  const t = m(CONSTRUCTION.doorThickness);
  const w = m(panel.w), h = m(panel.h);
  const cx = m(panel.x) + w / 2, cy = m(panel.y) + h / 2;
  const small = panel.h < inches(8);

  if (style === 'slab' || (small && style !== 'shaker')) {
    return (
      <RoundedBox args={[w, h, t]} radius={0.0015} smoothness={2} position={[cx, cy, t / 2]} material={material} castShadow receiveShadow />
    );
  }

  // Five-piece door: stiles, rails, recessed centre panel.
  const rail = m(small ? inches(1.25) : CONSTRUCTION.shakerRail);
  const recess = m(CONSTRUCTION.panelRecess);
  const innerW = w - rail * 2, innerH = h - rail * 2;
  const pieces: [number, number, number, number][] = [
    [-w / 2 + rail / 2, 0, rail, h],
    [w / 2 - rail / 2, 0, rail, h],
    [0, h / 2 - rail / 2, innerW, rail],
    [0, -h / 2 + rail / 2, innerW, rail],
  ];
  const panelDepth = style === 'raised-panel' ? t - recess / 2 : t - recess;
  return (
    <group position={[cx, cy, 0]}>
      {pieces.map(([x, y, pw, ph], i) => (
        <RoundedBox key={i} args={[pw, ph, t]} radius={0.0015} smoothness={2} position={[x, y, t / 2]} material={material} castShadow receiveShadow />
      ))}
      <mesh position={[0, 0, panelDepth / 2]} material={material} castShadow receiveShadow>
        <boxGeometry args={[innerW, innerH, panelDepth]} />
      </mesh>
      {style === 'raised-panel' && (
        <RoundedBox args={[innerW - 0.04, innerH - 0.04, t]} radius={0.006} smoothness={3} position={[0, 0, t / 2 - 0.002]} material={material} castShadow receiveShadow />
      )}
    </group>
  );
}

function Pull({ panel, kind, finish, metal }: { panel: Panel; kind: 'base' | 'wall' | 'tall'; finish: CabinetFinish; metal: THREE.Material }) {
  const t = m(CONSTRUCTION.doorThickness);
  const inset = m(inches(2.5));
  let x = m(panel.x + panel.w / 2), y = m(panel.y + panel.h / 2);
  let vertical = false;
  if (panel.kind === 'door') {
    vertical = true;
    x = panel.hinge === 'left' ? m(panel.x + panel.w) - inset : m(panel.x) + inset;
    // Base doors: pull near the top. Wall doors: near the bottom.
    y = kind === 'wall' ? m(panel.y) + inset + 0.06 : m(panel.y + panel.h) - inset - 0.06;
  }
  if (panel.kind === 'false-front') return null;

  const z = t;
  // "Cup" means cup pulls on drawers and knobs on doors.
  if (finish.hardwareStyle === 'knob' || (finish.hardwareStyle === 'cup' && vertical)) {
    return (
      <group position={[x, y, z]}>
        <mesh material={metal} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]} castShadow>
          <cylinderGeometry args={[0.005, 0.007, 0.024, 16]} />
        </mesh>
        <mesh material={metal} position={[0, 0, 0.028]} scale={[1, 1, 0.7]} castShadow>
          <sphereGeometry args={[0.015, 24, 16]} />
        </mesh>
      </group>
    );
  }
  if (finish.hardwareStyle === 'cup' && !vertical) {
    return (
      <mesh material={metal} position={[x, y + 0.008, z + 0.012]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.03, 32, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
    );
  }
  // Bar pull, 160 mm centres on drawers/doors, longer on wide drawers.
  const length = !vertical && panel.w > inches(24) ? 0.3 : 0.2;
  const centres = length - 0.04;
  return (
    <group position={[x, y, z]} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
      <mesh material={metal} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.032]} castShadow>
        <cylinderGeometry args={[0.0063, 0.0063, length, 20]} />
      </mesh>
      {[-centres / 2, centres / 2].map((px) => (
        <mesh key={px} material={metal} rotation={[Math.PI / 2, 0, 0]} position={[px, 0, 0.016]} castShadow>
          <cylinderGeometry args={[0.0045, 0.0045, 0.032, 12]} />
        </mesh>
      ))}
    </group>
  );
}

const HARDWARE_MATERIAL: Record<HardwareFinish, () => THREE.MeshPhysicalMaterial> = {
  brass: () => new THREE.MeshPhysicalMaterial({ color: '#c8a466', metalness: 1, roughness: 0.28 }),
  black: () => new THREE.MeshPhysicalMaterial({ color: '#1c1c1c', metalness: 0.6, roughness: 0.55 }),
  nickel: () => new THREE.MeshPhysicalMaterial({ color: '#c9c9c6', metalness: 1, roughness: 0.22 }),
};

/**
 * A cabinet generated from its spec. Origin is the back-left-bottom corner; the front faces +z.
 */
export function Cabinet({ spec, finish }: { spec: CabinetSpec; finish: CabinetFinish }) {
  const paint = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: finish.color, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    [finish.color],
  );
  const kick = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(finish.color).multiplyScalar(0.6), roughness: 0.6 }), [finish.color]);
  const metal = useMemo(() => HARDWARE_MATERIAL[finish.hardwareFinish](), [finish.hardwareFinish]);
  const panels = useMemo(() => layoutFronts(spec), [spec]);

  const t = m(CONSTRUCTION.doorThickness);
  const w = m(spec.width), h = m(spec.height), d = m(spec.depth);
  const bottom = spec.kind === 'base' ? m(STANDARD.toeKick.height) : 0;
  const boxDepth = d - t;

  return (
    <group>
      {/* Carcass (its front face doubles as the face frame on framed cabinets). */}
      <mesh position={[w / 2, bottom + (h - bottom) / 2, boxDepth / 2]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[w, h - bottom, boxDepth]} />
      </mesh>
      {spec.kind === 'base' && (
        <mesh position={[w / 2, bottom / 2, (boxDepth - m(STANDARD.toeKick.depth)) / 2]} material={kick} receiveShadow>
          <boxGeometry args={[w, bottom, boxDepth - m(STANDARD.toeKick.depth)]} />
        </mesh>
      )}
      <group position={[0, 0, boxDepth]}>
        {panels.map((p, i) => (
          <group key={i}>
            <FrontPanel panel={p} style={spec.doorStyle} material={paint} />
            <Pull panel={p} kind={spec.kind} finish={finish} metal={metal} />
          </group>
        ))}
      </group>
    </group>
  );
}
