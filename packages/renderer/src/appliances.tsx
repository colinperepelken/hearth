import { useMemo } from 'react';
import * as THREE from 'three';
import { inches, type ApplianceType } from '@hearth/core';
import type { ApplianceMaterials } from './surfaces';

/**
 * Procedural appliances, in metres. Origin is the back-left-bottom corner and the front faces +z,
 * matching <Cabinet>. Details are simplified but proportioned like the real units.
 */

const glass = new THREE.MeshPhysicalMaterial({ color: '#0b0b0c', roughness: 0.05, metalness: 0.2, clearcoat: 1 });
const iron = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6, metalness: 0.4 });
const dark = new THREE.MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.8 });
const ring = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.4 });

function Box({ size, at, mat, cast = true }: { size: [number, number, number]; at: [number, number, number]; mat: THREE.Material; cast?: boolean }) {
  return (
    <mesh position={at} material={mat} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** Bar handle along x (or y when vertical) standing off a front face at z. */
function Handle({ at, length, vertical = false, mat }: { at: [number, number, number]; length: number; vertical?: boolean; mat: THREE.Material }) {
  return (
    <group position={at} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.04]} material={mat} castShadow>
        <cylinderGeometry args={[0.011, 0.011, length, 20]} />
      </mesh>
      {[-length / 2 + 0.03, length / 2 - 0.03].map((x) => (
        <mesh key={x} rotation={[Math.PI / 2, 0, 0]} position={[x, 0, 0.02]} material={mat} castShadow>
          <cylinderGeometry args={[0.007, 0.007, 0.04, 12]} />
        </mesh>
      ))}
    </group>
  );
}

interface Props {
  type: ApplianceType;
  w: number;
  d: number;
  h: number;
  mats: ApplianceMaterials;
  fuel?: 'gas' | 'electric';
  slideIn?: boolean;
  /** Ceiling height above the appliance's underside, for chimney hoods. */
  toCeiling: number;
}

function Range({ w, d, h, mats, fuel, slideIn }: Props) {
  const top = inches(36) / 1000;
  const door = 0.012;
  const body = d - door;
  return (
    <group>
      <Box size={[w, top - 0.02, body]} at={[w / 2, (top - 0.02) / 2, body / 2]} mat={mats.body} />
      {/* Cooktop */}
      <Box size={[w, 0.02, d]} at={[w / 2, top - 0.01, d / 2]} mat={fuel === 'gas' ? iron : glass} />
      {fuel === 'gas' ? (
        <group position={[0, top, 0]}>
          {[0.27, 0.73].map((fx) =>
            [0.32, 0.72].map((fz) => (
              <group key={`${fx}${fz}`} position={[w * fx, 0, d * fz]}>
                <mesh position={[0, 0.012, 0]} material={ring} castShadow>
                  <cylinderGeometry args={[0.045, 0.05, 0.024, 24]} />
                </mesh>
              </group>
            )),
          )}
          {/* Continuous grates */}
          {[0.25, 0.5, 0.75].map((fz) => (
            <Box key={fz} size={[w - 0.04, 0.012, 0.012]} at={[w / 2, 0.035, d * (0.15 + fz * 0.7)]} mat={iron} />
          ))}
          {[0.08, 0.5, 0.92].map((fx) => (
            <Box key={fx} size={[0.012, 0.012, d * 0.75]} at={[w * fx, 0.035, d * 0.52]} mat={iron} />
          ))}
        </group>
      ) : (
        <group position={[0, top + 0.001, 0]}>
          {(
            [
              [0.28, 0.32, 0.09],
              [0.72, 0.32, 0.07],
              [0.28, 0.72, 0.07],
              [0.72, 0.72, 0.1],
            ] as const
          ).map(([fx, fz, r]) => (
            <mesh key={`${fx}${fz}`} position={[w * fx, 0, d * fz]} rotation={[-Math.PI / 2, 0, 0]} material={ring}>
              <ringGeometry args={[r - 0.004, r, 48]} />
            </mesh>
          ))}
        </group>
      )}
      {/* Oven door with window, drawer below */}
      <group position={[0, 0, body]}>
        <Box size={[w - 0.01, 0.56, door]} at={[w / 2, 0.42, door / 2]} mat={mats.body} />
        <Box size={[w * 0.62, 0.26, 0.004]} at={[w / 2, 0.42, door + 0.001]} mat={glass} cast={false} />
        <Handle at={[w / 2, 0.66, door]} length={w * 0.8} mat={mats.handle} />
        <Box size={[w - 0.01, 0.12, door]} at={[w / 2, 0.075, door / 2]} mat={mats.body} />
        <Handle at={[w / 2, 0.11, door]} length={w * 0.6} mat={mats.handle} />
        {/* Controls: front knobs on slide-ins */}
        {slideIn && (
          <group position={[0, top - 0.06, door]}>
            {[0.15, 0.3, 0.7, 0.85].map((fx) => (
              <mesh key={fx} position={[w * fx, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} material={mats.handle} castShadow>
                <cylinderGeometry args={[0.02, 0.022, 0.025, 24]} />
              </mesh>
            ))}
            <Box size={[0.12, 0.035, 0.003]} at={[w / 2, 0, 0.001]} mat={glass} cast={false} />
          </group>
        )}
      </group>
      {!slideIn && h > top + 0.05 && (
        <group>
          <Box size={[w, h - top, 0.07]} at={[w / 2, top + (h - top) / 2, 0.035]} mat={mats.body} />
          <Box size={[w * 0.5, 0.04, 0.003]} at={[w / 2, top + (h - top) / 2, 0.071]} mat={glass} cast={false} />
          {[0.1, 0.2, 0.8, 0.9].map((fx) => (
            <mesh key={fx} position={[w * fx, top + (h - top) / 2, 0.082]} rotation={[Math.PI / 2, 0, 0]} material={mats.handle} castShadow>
              <cylinderGeometry args={[0.018, 0.02, 0.025, 24]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function FridgeFrench({ w, d, h, mats }: Props) {
  const door = 0.06;
  const body = d - door;
  const drawerH = h * 0.3;
  const gap = 0.004;
  const doorH = h - drawerH - gap * 2;
  const half = (w - gap) / 2;
  return (
    <group>
      <Box size={[w, h, body]} at={[w / 2, h / 2, body / 2]} mat={mats.body} />
      <group position={[0, 0, body]}>
        <Box size={[w, drawerH, door]} at={[w / 2, drawerH / 2, door / 2]} mat={mats.body} />
        <Handle at={[w / 2, drawerH - 0.06, door]} length={w * 0.7} mat={mats.handle} />
        <Box size={[half, doorH, door]} at={[half / 2, drawerH + gap + doorH / 2, door / 2]} mat={mats.body} />
        <Box size={[half, doorH, door]} at={[w - half / 2, drawerH + gap + doorH / 2, door / 2]} mat={mats.body} />
        <Handle at={[half - 0.04, drawerH + doorH * 0.55, door]} length={doorH * 0.55} vertical mat={mats.handle} />
        <Handle at={[w - half + 0.04, drawerH + doorH * 0.55, door]} length={doorH * 0.55} vertical mat={mats.handle} />
      </group>
    </group>
  );
}

function FridgeTopFreezer({ w, d, h, mats }: Props) {
  const door = 0.06;
  const body = d - door;
  const freezer = h * 0.3, gap = 0.004;
  const fresh = h - freezer - gap;
  return (
    <group>
      <Box size={[w, h, body]} at={[w / 2, h / 2, body / 2]} mat={mats.body} />
      <group position={[0, 0, body]}>
        <Box size={[w, fresh, door]} at={[w / 2, fresh / 2, door / 2]} mat={mats.body} />
        <Box size={[w, freezer, door]} at={[w / 2, fresh + gap + freezer / 2, door / 2]} mat={mats.body} />
        <Handle at={[w - 0.05, fresh * 0.7, door]} length={fresh * 0.4} vertical mat={mats.handle} />
        <Handle at={[w - 0.05, fresh + gap + freezer * 0.3, door]} length={freezer * 0.4} vertical mat={mats.handle} />
      </group>
    </group>
  );
}

function Dishwasher({ w, d, h, mats }: Props) {
  const panel = 0.02;
  const kick = 0.1;
  return (
    <group>
      <Box size={[w, h - kick, d - panel]} at={[w / 2, kick + (h - kick) / 2, (d - panel) / 2]} mat={dark} />
      <Box size={[w, kick, d - 0.08]} at={[w / 2, kick / 2, (d - 0.08) / 2]} mat={dark} />
      <Box size={[w - 0.004, h - kick, panel]} at={[w / 2, kick + (h - kick) / 2, d - panel / 2]} mat={mats.body} />
      <Box size={[w - 0.004, 0.07, 0.003]} at={[w / 2, h - 0.04, d + 0.001]} mat={glass} cast={false} />
      <Handle at={[w / 2, h - 0.11, d]} length={w * 0.75} mat={mats.handle} />
    </group>
  );
}

function Microwave({ w, d, h, mats, counter }: Props & { counter?: boolean }) {
  const door = 0.03;
  const body = d - door;
  const bodyMat = counter ? dark : mats.body;
  return (
    <group>
      <Box size={[w, h, body]} at={[w / 2, h / 2, body / 2]} mat={bodyMat} />
      <group position={[0, 0, body]}>
        <Box size={[w * 0.74, h - 0.01, door]} at={[w * 0.37, h / 2, door / 2]} mat={bodyMat} />
        <Box size={[w * 0.5, h * 0.55, 0.004]} at={[w * 0.33, h / 2, door + 0.001]} mat={glass} cast={false} />
        <Box size={[w * 0.25, h - 0.01, door]} at={[w * 0.875, h / 2, door / 2]} mat={glass} />
        {!counter && <Handle at={[w * 0.7, h / 2, door]} length={h * 0.7} vertical mat={mats.handle} />}
      </group>
    </group>
  );
}

function ChimneyHood({ w, d, mats, toCeiling }: Props) {
  const canopy = useMemo(() => {
    // Square frustum (4-sided cylinder) scaled to the hood's footprint.
    const g = new THREE.CylinderGeometry(0.3, Math.SQRT1_2, 0.22, 4, 1);
    g.rotateY(Math.PI / 4);
    return g;
  }, []);
  const lip = 0.06;
  const chimneyH = Math.max(0.1, toCeiling - lip - 0.22);
  return (
    <group>
      <Box size={[w, lip, d]} at={[w / 2, lip / 2, d / 2]} mat={mats.body} />
      <mesh geometry={canopy} position={[w / 2, lip + 0.11, d * 0.42]} scale={[w, 1, d * 0.84]} material={mats.body} castShadow />
      <Box size={[0.26, chimneyH, 0.22]} at={[w / 2, lip + 0.22 + chimneyH / 2, 0.11]} mat={mats.body} />
    </group>
  );
}

function UnderCabinetHood({ w, d, h, mats }: Props) {
  return (
    <group>
      <Box size={[w, h, d]} at={[w / 2, h / 2, d / 2]} mat={mats.body} />
      <Box size={[w * 0.9, 0.004, d * 0.7]} at={[w / 2, -0.001, d * 0.45]} mat={dark} cast={false} />
    </group>
  );
}

function WallOvenFront({ w, h, mats }: { w: number; h: number; mats: ApplianceMaterials }) {
  return (
    <group>
      <Box size={[w, h, 0.02]} at={[w / 2, h / 2, 0.01]} mat={mats.body} />
      <Box size={[w * 0.92, 0.08, 0.004]} at={[w / 2, h - 0.06, 0.021]} mat={glass} cast={false} />
      <Box size={[w * 0.65, h * 0.42, 0.004]} at={[w / 2, h * 0.42, 0.021]} mat={glass} cast={false} />
      <Handle at={[w / 2, h - 0.15, 0.02]} length={w * 0.8} mat={mats.handle} />
    </group>
  );
}

export function Appliance(props: Props) {
  switch (props.type) {
    case 'range':
      return <Range {...props} />;
    case 'fridge-french':
      return <FridgeFrench {...props} />;
    case 'fridge-top-freezer':
      return <FridgeTopFreezer {...props} />;
    case 'dishwasher':
      return <Dishwasher {...props} />;
    case 'microwave-otr':
      return <Microwave {...props} />;
    case 'microwave-counter':
      return <Microwave {...props} counter />;
    case 'hood-chimney':
      return <ChimneyHood {...props} />;
    case 'hood-under-cabinet':
      return <UnderCabinetHood {...props} />;
    case 'wall-oven':
      return null; // composed with cabinetry in <Item>
  }
}

export { WallOvenFront };
