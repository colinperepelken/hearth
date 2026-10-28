import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Environment } from '@react-three/drei';
import { STANDARD, feet, inches, toMetres as m, type CabinetSpec } from '@hearth/core';
import { Backsplash, Cabinet, Countertop, RoomShell, type CabinetFinish } from '@hearth/renderer';
import { useApp } from '../store';

RectAreaLightUniformsLib.init();

/** A fixed 12' x 11' test kitchen: one wall of cabinets with a sink under a window. */
export const ROOM = { width: m(feet(12)), depth: m(feet(11)), height: m(feet(8)) };

type Run = { width: number; front: CabinetSpec['front'] }[];

const BASE_RUN: Run = [
  { width: 18, front: { type: 'drawers', count: 3 } },
  { width: 30, front: { type: 'door-drawer', drawerHeight: inches(6) } },
  { width: 36, front: { type: 'sink' } },
  { width: 30, front: { type: 'door-drawer', drawerHeight: inches(6) } },
  { width: 24, front: { type: 'door-drawer', drawerHeight: inches(6) } },
];
// `null` leaves a gap (the window over the sink).
const WALL_RUN: (number | null)[] = [18, 30, null, 30, 24];
const WALL_HEIGHT = inches(36);

const SINK_CENTER = inches(18 + 30 + 18);
const WINDOW = { centerX: m(SINK_CENTER), width: m(inches(28)), sill: m(inches(42)), height: m(inches(42)) };

export function SpikeScene() {
  const { cabinetColor, wallColor, doorStyle, system, hardwareStyle, hardwareFinish } = useApp();
  const finish: CabinetFinish = { color: cabinetColor, hardwareStyle, hardwareFinish };

  const runLength = BASE_RUN.reduce((s, c) => s + c.width, 0);
  const counterTop = STANDARD.base.height + STANDARD.countertop.thickness;
  const wallBottom = STANDARD.wallCabinetBottom;

  let x = 0;
  const bases = BASE_RUN.map((c) => {
    const spec: CabinetSpec = {
      kind: 'base',
      system,
      width: inches(c.width),
      height: STANDARD.base.height,
      depth: STANDARD.base.depth,
      front: c.front,
      doorStyle,
    };
    const at = x;
    x += c.width;
    return { spec, x: at };
  });
  x = 0;
  const uppers = WALL_RUN.flatMap((w, i) => {
    const width = w ?? BASE_RUN[i]!.width;
    const at = x;
    x += width;
    if (w === null) return [];
    const spec: CabinetSpec = { kind: 'wall', system, width: inches(w), height: WALL_HEIGHT, depth: STANDARD.wall.depth, front: { type: 'doors' }, doorStyle };
    return [{ spec, x: at }];
  });

  const winL = SINK_CENTER - inches(18), winR = SINK_CENTER + inches(18);

  return (
    <group>
      <Environment preset="apartment" environmentIntensity={0.35} />
      <Lights runLength={m(inches(runLength))} underCabinetY={m(wallBottom)} />

      <RoomShell width={ROOM.width} depth={ROOM.depth} height={ROOM.height} window={WINDOW} wallColor={wallColor} />

      {bases.map(({ spec, x }, i) => (
        <group key={`b${i}`} position={[m(inches(x)), 0, 0]}>
          <Cabinet spec={spec} finish={finish} />
        </group>
      ))}
      {uppers.map(({ spec, x }, i) => (
        <group key={`w${i}`} position={[m(inches(x)), m(wallBottom), 0]}>
          <Cabinet spec={spec} finish={finish} />
        </group>
      ))}

      <group position={[0, m(STANDARD.base.height), 0]}>
        <Countertop
          length={m(inches(runLength + 1))}
          depth={m(STANDARD.base.depth + STANDARD.countertop.overhang)}
          thickness={m(STANDARD.countertop.thickness)}
          sink={{ centerX: m(SINK_CENTER), width: m(inches(30)), depth: m(inches(16)) }}
        />
      </group>

      <Backsplash x={0} y={m(counterTop)} width={m(winL)} height={m(wallBottom - counterTop)} />
      <Backsplash x={m(winR)} y={m(counterTop)} width={m(inches(runLength) - winR)} height={m(wallBottom - counterTop)} />
      <Backsplash x={m(winL)} y={m(counterTop)} width={m(winR - winL)} height={m(inches(42) - counterTop)} />
    </group>
  );
}

function Lights({ runLength, underCabinetY }: { runLength: number; underCabinetY: number }) {
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff3e0', 5);
    l.position.set(WINDOW.centerX + 1.6, 3.4, -3.2);
    l.target.position.set(WINDOW.centerX - 0.4, 0, 2.4);
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
    Object.assign(l.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 12 });
    return l;
  }, []);
  useEffect(() => () => sun.dispose(), [sun]);

  const pots: [number, number][] = [
    [0.9, 1.3],
    [2.75, 1.3],
    [0.9, 2.7],
    [2.75, 2.7],
  ];
  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
      {pots.map(([x, z]) => (
        <spotLight key={`${x},${z}`} position={[x, ROOM.height - 0.02, z]} angle={1.0} penumbra={1} intensity={9} decay={2} color="#fff1dd" target-position={[x, 0, z]} />
      ))}
      {pots.map(([x, z]) => (
        <mesh key={`can${x},${z}`} position={[x, ROOM.height - 0.002, z]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.06, 32]} />
          <meshStandardMaterial color="#fff" emissive="#fff1dd" emissiveIntensity={3} />
        </mesh>
      ))}
      {/* Under-cabinet LED strip. */}
      <rectAreaLight
        position={[runLength / 2, underCabinetY - 0.01, 0.08]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={runLength}
        height={0.03}
        intensity={25}
        color="#ffe9cc"
      />
    </>
  );
}
