import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

/**
 * Progressive path tracing of the current scene and camera. While mounted it takes over
 * rendering (useFrame priority 1), so post-processing should be unmounted alongside.
 */
export function PathTracer({ onSamples, bounces = 6 }: { onSamples?: (n: number) => void; bounces?: number }) {
  const { gl, scene, camera } = useThree();
  const tracer = useMemo(() => {
    const t = new WebGLPathTracer(gl);
    t.bounces = bounces;
    t.filterGlossyFactor = 0.5;
    t.tiles.set(2, 2);
    t.minSamples = 1;
    t.fadeDuration = 300;
    t.renderScale = Math.min(window.devicePixelRatio, 2) / gl.getPixelRatio();
    return t;
  }, [gl, bounces]);

  useEffect(() => {
    const prev = gl.toneMapping, prevExposure = gl.toneMappingExposure;
    gl.toneMapping = THREE.AgXToneMapping;
    // Bounced light makes the traced image brighter than the rasterized view.
    gl.toneMappingExposure = 0.7;
    // three-gpu-pathtracer 0.0.27 renders clearcoated materials black with three r186,
    // so clearcoat is switched off while tracing and restored afterwards.
    const clearcoats = new Map<THREE.MeshPhysicalMaterial, number>();
    scene.traverse((o) => {
      const mats = (o as THREE.Mesh).isMesh ? ([] as THREE.Material[]).concat((o as THREE.Mesh).material) : [];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshPhysicalMaterial && mat.clearcoat > 0 && !clearcoats.has(mat)) {
          clearcoats.set(mat, mat.clearcoat);
          mat.clearcoat = 0;
        }
      }
    });
    tracer.setScene(scene, camera);
    return () => {
      gl.toneMapping = prev;
      gl.toneMappingExposure = prevExposure;
      clearcoats.forEach((v, mat) => (mat.clearcoat = v));
      tracer.dispose();
    };
  }, [tracer, gl, scene, camera]);

  useFrame(() => {
    tracer.renderSample();
    onSamples?.(Math.floor(tracer.samples));
  }, 1);

  return null;
}
