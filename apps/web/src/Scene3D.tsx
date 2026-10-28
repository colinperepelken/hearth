import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Loader, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {
  bounds,
  catalogItem,
  footprint,
  pointInPolygon,
  roomVertices,
  snapItem,
  toMetres as m,
  type Project,
  type Vec2,
} from '@hearth/core';
import { CounterRuns, Item, PathTracer, RoomLights, RoomModel, WalkControls } from '@hearth/renderer';
import { level, room, useHearth } from './doc';

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Converts a ray to a plan point on the floor, in mm. */
function rayToPlan(ray: THREE.Ray): Vec2 | null {
  const hit = ray.intersectPlane(floorPlane, new THREE.Vector3());
  return hit ? { x: hit.x * 1000, y: hit.z * 1000 } : null;
}

/** Set while the canvas is mounted so catalog drops can be placed on the floor. */
export const sceneDrop: { toPlan: ((clientX: number, clientY: number) => Vec2 | null) | null } = { toPlan: null };

function DropBridge() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    sceneDrop.toPlan = (x, y) => {
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      return rayToPlan(raycaster.ray);
    };
    return () => void (sceneDrop.toPlan = null);
  }, [camera, gl]);
  return null;
}

function roomCentre(p: Project) {
  const b = bounds(roomVertices(room(p)));
  return { cx: m((b.minX + b.maxX) / 2), cz: m((b.minY + b.maxY) / 2), span: m(Math.max(b.maxX - b.minX, b.maxY - b.minY)), maxZ: m(b.maxY) };
}

/** Moves the camera when switching between orbit and walk. */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const mode = useHearth((s) => s.mode);
  const prev = useRef(mode);
  useEffect(() => {
    const { cx, cz, span, maxZ } = roomCentre(useHearth.getState().project);
    if (mode === 'walk' && prev.current !== 'walk') {
      camera.position.set(cx, camera.position.y, maxZ - 0.8);
      camera.lookAt(cx, 1.3, cz - span);
    }
    if (mode === 'orbit' && prev.current === 'walk') camera.position.set(cx - span * 0.1, 2.5, maxZ + span * 0.55);
    prev.current = mode;
  }, [mode, camera]);
  return null;
}

function Items() {
  const project = useHearth((s) => s.project);
  const selection = useHearth((s) => s.selection);
  const step = useHearth((s) => s.step);
  const mode = useHearth((s) => s.mode);
  const drag = useRef<{ id: string; grab: Vec2; orig: Project; moved: boolean } | null>(null);
  const r = room(project);
  const interactive = step === 'design' && mode === 'orbit';

  const down = (id: string) => (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    const s = useHearth.getState();
    s.select({ kind: 'item', id });
    const p = rayToPlan(e.ray);
    const it = r.items.find((i) => i.id === id);
    if (!p || !it) return;
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    s.set({ dragging: true });
    drag.current = { id, grab: { x: p.x - it.position.x, y: p.y - it.position.y }, orig: s.project, moved: false };
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    const p = rayToPlan(e.ray);
    if (!p) return;
    if (!d.moved) {
      useHearth.getState().checkpoint();
      d.moved = true;
    }
    const rr = room(d.orig);
    const it = rr.items.find((i) => i.id === d.id)!;
    const snapped = snapItem(rr, rr.items, it, { x: p.x - d.grab.x, y: p.y - d.grab.y });
    useHearth.getState().edit(
      (doc) => {
        const di = room(doc).items.find((i) => i.id === d.id)!;
        di.position.x = snapped.x;
        di.position.y = snapped.y;
        di.rotation = snapped.rotation;
      },
      { history: false },
    );
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    useHearth.getState().set({ dragging: false });
  };

  return (
    <group onPointerMove={move} onPointerUp={up}>
      {r.items.map((it) => (
        <Item
          key={it.id}
          item={it}
          finishes={project.finishes}
          ceilingHeight={level(project).ceilingHeight}
          selected={interactive && selection?.kind === 'item' && selection.id === it.id}
          onPointerDown={down(it.id)}
        />
      ))}
    </group>
  );
}

function SceneContents() {
  const project = useHearth((s) => s.project);
  const mode = useHearth((s) => s.mode);
  const r = room(project);
  const lvl = level(project);
  const f = project.finishes;
  return (
    <>
      <Environment preset="apartment" environmentIntensity={0.35} />
      <RoomLights room={r} height={lvl.ceilingHeight} items={r.items} />
      <RoomModel room={r} height={lvl.ceilingHeight} wallPaint={f.wallPaint} floor={f.floor} cutaway={mode === 'orbit'} />
      <Items />
      <CounterRuns room={r} items={r.items} countertop={f.countertop} backsplash={f.backsplash} />
    </>
  );
}

export function Scene3D() {
  const project = useHearth((s) => s.project);
  const mode = useHearth((s) => s.mode);
  const dragging = useHearth((s) => s.dragging);
  const eyeHeight = useHearth((s) => s.eyeHeight);
  const r = room(project);
  const { cx, cz, span, maxZ } = useMemo(() => roomCentre(project), [project]);
  // Restart the path tracer whenever the design changes.
  const traceKey = project.updatedAt;

  const verts = roomVertices(r);
  const blockers = r.items.filter((i) => i.position.z < 900 && catalogItem(i.catalogId).category !== 'furniture').map(footprint);
  const canStand = (x: number, z: number) => {
    const p = { x: x * 1000, y: z * 1000 };
    if (!pointInPolygon(p, verts)) return false;
    // Keep ~25 cm from walls and out of cabinets/appliances.
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i]!, b = verts[(i + 1) % verts.length]!;
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
      if (Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t) < 250) return false;
    }
    return !blockers.some((fp) => pointInPolygon(p, fp));
  };

  return (
    <>
      <Canvas
        shadows="soft"
        flat
        dpr={[1, 2]}
        camera={{ position: [cx - span * 0.1, 2.5, maxZ + span * 0.55], fov: 50, near: 0.02, far: 60 }}
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        onPointerMissed={() => useHearth.getState().step === 'design' && useHearth.getState().select(null)}
      >
        <Suspense fallback={null}>
          <SceneContents />
          {mode === 'photo' && (
            <PathTracer key={traceKey} onSamples={(n) => n !== useHearth.getState().samples && useHearth.getState().set({ samples: n })} />
          )}
        </Suspense>
        <CameraRig />
        <DropBridge />
        {mode === 'orbit' && (
          <OrbitControls makeDefault enabled={!dragging} target={[cx, 0.9, cz]} maxPolarAngle={Math.PI * 0.49} minDistance={0.4} maxDistance={span * 3} enableDamping />
        )}
        {mode === 'walk' && <WalkControls eyeHeight={m(eyeHeight)} canStand={canStand} />}
        {mode !== 'photo' && (
          <EffectComposer multisampling={0}>
            <N8AO aoRadius={0.5} distanceFalloff={0.6} intensity={2.2} quality="high" />
            <Bloom luminanceThreshold={1.1} intensity={0.25} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.AGX} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>
      <Loader />
    </>
  );
}
