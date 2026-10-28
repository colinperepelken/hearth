import { useMemo } from 'react';
import * as THREE from 'three';
import type { SinkOptions } from '@hearth/core';

/** Sinks and faucets in metres. Coordinates match <Countertop>: x along the run, y up from the counter's underside, z towards the front. */

const sinkMaterials: Record<SinkOptions['finish'], THREE.MeshPhysicalMaterial> = {
  stainless: new THREE.MeshPhysicalMaterial({ color: '#d4d5d6', metalness: 0.9, roughness: 0.32 }),
  black: new THREE.MeshPhysicalMaterial({ color: '#222324', roughness: 0.6 }), // granite composite
  white: new THREE.MeshPhysicalMaterial({ color: '#f5f5f2', roughness: 0.15, clearcoat: 0.8 }), // fireclay
};

const faucetMaterials: Record<SinkOptions['faucetFinish'], THREE.MeshPhysicalMaterial> = {
  chrome: new THREE.MeshPhysicalMaterial({ color: '#e8e8e8', metalness: 1, roughness: 0.08 }),
  nickel: new THREE.MeshPhysicalMaterial({ color: '#c9c7c1', metalness: 1, roughness: 0.3 }),
  black: new THREE.MeshPhysicalMaterial({ color: '#1b1b1b', metalness: 0.5, roughness: 0.5 }),
  brass: new THREE.MeshPhysicalMaterial({ color: '#c8a466', metalness: 1, roughness: 0.25 }),
};

const drainMat = new THREE.MeshPhysicalMaterial({ color: '#b9b9b9', metalness: 1, roughness: 0.2 });

/** Open-topped box: bottom and four sides of thickness `t`, top at y = 0. */
function Bowl({ cx, cz, w, d, h, mat, t = 0.006 }: { cx: number; cz: number; w: number; d: number; h: number; mat: THREE.Material; t?: number }) {
  return (
    <group position={[cx, -h / 2, cz]}>
      <mesh position={[0, -h / 2 + t / 2, 0]} material={mat} receiveShadow>
        <boxGeometry args={[w, t, d]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[(s * (w - t)) / 2, 0, 0]} material={mat} receiveShadow castShadow>
          <boxGeometry args={[t, h, d]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, 0, (s * (d - t)) / 2]} material={mat} receiveShadow castShadow>
          <boxGeometry args={[w, h, t]} />
        </mesh>
      ))}
      <mesh position={[0, -h / 2 + t + 0.001, d * 0.15]} rotation={[-Math.PI / 2, 0, 0]} material={drainMat}>
        <circleGeometry args={[0.045, 32]} />
      </mesh>
    </group>
  );
}

/**
 * The basin(s) for a cutout spanning x in [x0, x1] and z in [z0, z1]. Farmhouse sinks also get a
 * front apron at z1, standing in for the cabinet's false front.
 */
export function SinkBasin({ x0, x1, z0, z1, options }: { x0: number; x1: number; z0: number; z1: number; options: SinkOptions }) {
  const mat = sinkMaterials[options.finish];
  const w = x1 - x0, d = z1 - z0, cz = (z0 + z1) / 2;
  if (options.style === 'double') {
    const gap = 0.03, bw = (w - gap) / 2;
    return (
      <group>
        <Bowl cx={x0 + bw / 2} cz={cz} w={bw} d={d} h={0.23} mat={mat} />
        <Bowl cx={x1 - bw / 2} cz={cz} w={bw} d={d} h={0.23} mat={mat} />
      </group>
    );
  }
  if (options.style === 'farmhouse') {
    const h = 0.25, t = options.finish === 'stainless' ? 0.006 : 0.025;
    return (
      <group>
        <Bowl cx={(x0 + x1) / 2} cz={cz} w={w} d={d} h={h} mat={mat} t={t} />
        <mesh position={[(x0 + x1) / 2, -h / 2, z1 + 0.012]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[w + 0.01, h, 0.025]} />
        </mesh>
      </group>
    );
  }
  return <Bowl cx={(x0 + x1) / 2} cz={cz} w={w} d={d} h={0.23} mat={mat} />;
}

function tube(points: [number, number, number][], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 64, radius, 20, false);
}

function Lever({ mat }: { mat: THREE.Material }) {
  return (
    <mesh position={[0.045, 0.09, 0]} rotation={[0, 0, -Math.PI / 2.6]} material={mat} castShadow>
      <cylinderGeometry args={[0.006, 0.006, 0.08, 12]} />
    </mesh>
  );
}

/** Faucet standing on the counter at `position`, spout reaching towards +z. */
export function Faucet({ position, style, finish }: { position: [number, number, number]; style: SinkOptions['faucet']; finish: SinkOptions['faucetFinish'] }) {
  const mat = faucetMaterials[finish];
  const geo = useMemo(() => {
    switch (style) {
      case 'gooseneck':
        return { neck: tube([[0, 0, 0], [0, 0.25, 0], [0, 0.36, 0.06], [0, 0.33, 0.2], [0, 0.25, 0.22]], 0.013) };
      case 'pull-down':
        return { neck: tube([[0, 0, 0], [0, 0.34, 0], [0, 0.41, 0.06], [0, 0.39, 0.16], [0, 0.35, 0.19]], 0.015) };
      case 'bridge':
        return { neck: tube([[0, 0.08, 0], [0, 0.26, 0], [0, 0.31, 0.06], [0, 0.28, 0.17], [0, 0.22, 0.19]], 0.011) };
      case 'commercial': {
        // Coil spring around the riser.
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 240; i++) {
          const a = i * 0.16;
          pts.push(new THREE.Vector3(Math.cos(a) * 0.03, 0.2 + i * 0.0013, Math.sin(a) * 0.03));
        }
        return {
          neck: tube([[0, 0, 0], [0, 0.52, 0], [0, 0.57, 0.05], [0, 0.52, 0.12], [0, 0.42, 0.14]], 0.011),
          coil: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.004, 8, false),
        };
      }
    }
  }, [style]);

  return (
    <group position={position}>
      {style === 'bridge' ? (
        <>
          {[-0.1, 0.1].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, 0.045, 0]} material={mat} castShadow>
                <cylinderGeometry args={[0.018, 0.022, 0.09, 24]} />
              </mesh>
              {/* Cross handle */}
              <mesh position={[0, 0.1, 0]} material={mat} castShadow>
                <boxGeometry args={[0.07, 0.012, 0.012]} />
              </mesh>
              <mesh position={[0, 0.1, 0]} material={mat} castShadow>
                <boxGeometry args={[0.012, 0.012, 0.07]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.075, 0]} rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 16]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.03, 0]} material={mat} castShadow>
            <cylinderGeometry args={[0.026, 0.03, 0.06, 32]} />
          </mesh>
          <Lever mat={mat} />
        </>
      )}
      <mesh geometry={geo.neck} material={mat} castShadow />
      {'coil' in geo && geo.coil && <mesh geometry={geo.coil} material={mat} castShadow />}
      {style === 'pull-down' && (
        <mesh position={[0, 0.32, 0.19]} material={mat} castShadow>
          <cylinderGeometry args={[0.02, 0.018, 0.08, 24]} />
        </mesh>
      )}
      {style === 'commercial' && (
        <mesh position={[0, 0.39, 0.14]} material={mat} castShadow>
          <cylinderGeometry args={[0.022, 0.018, 0.07, 24]} />
        </mesh>
      )}
      {(style === 'gooseneck' || style === 'bridge') && (
        <mesh position={[0, style === 'bridge' ? 0.21 : 0.24, style === 'bridge' ? 0.19 : 0.22]} material={mat} castShadow>
          <cylinderGeometry args={[0.016, 0.014, 0.04, 24]} />
        </mesh>
      )}
    </group>
  );
}
