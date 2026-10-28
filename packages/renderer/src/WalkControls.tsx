import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const SPEED = 1.4; // m/s, a normal walking pace

/**
 * First-person walk: click the view to look with the mouse, WASD / arrow keys to move,
 * Esc to release. The camera stays at `eyeHeight` metres and inside `bounds`.
 */
export function WalkControls({ eyeHeight, bounds }: { eyeHeight: number; bounds: WalkBounds }) {
  const camera = useThree((s) => s.camera);
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  useFrame((_, dt) => {
    const k = keys.current;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (f || r) {
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, camera.up).normalize();
      camera.position.addScaledVector(forward, f * SPEED * dt).addScaledVector(right, r * SPEED * dt);
    }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.minX, bounds.maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.minZ, bounds.maxZ);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, eyeHeight, 8, dt);
  });

  return <PointerLockControls />;
}
