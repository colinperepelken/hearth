import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Loader, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { formatLength, inches, toMetres as m } from '@hearth/core';
import { PathTracer, WalkControls } from '@hearth/renderer';
import { ROOM, SpikeScene } from './spike/SpikeScene';
import { FinishesPanel } from './FinishesPanel';
import { useApp, type ViewMode } from './store';

const ORBIT_TARGET: [number, number, number] = [ROOM.width / 2 - 0.3, 1.05, 0.4];

/** Restores the orbit camera when leaving walk mode, and drops to eye height when entering it. */
function CameraRig({ mode }: { mode: ViewMode }) {
  const camera = useThree((s) => s.camera);
  const prev = useRef(mode);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __scene: scene });
  }, [scene]);
  useEffect(() => {
    if (mode === 'walk' && prev.current !== 'walk') {
      camera.position.set(ROOM.width / 2, camera.position.y, ROOM.depth - 0.8);
      camera.lookAt(ROOM.width / 2 - 0.3, 1.3, 0);
    }
    if (mode === 'orbit' && prev.current === 'walk') {
      camera.position.set(ROOM.width * 0.78, 1.75, ROOM.depth - 0.4);
    }
    prev.current = mode;
  }, [mode, camera]);
  return null;
}

export function App() {
  const { mode, eyeHeight, units, samples, set } = useApp();
  const finishKey = useApp((s) => [s.cabinetColor, s.wallColor, s.doorStyle, s.system, s.hardwareStyle, s.hardwareFinish].join('|'));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Hearth</div>
        <nav className="stepper">
          {['Room', 'Cabinets', 'Appliances', 'Finishes', 'Furnish', 'Review'].map((s) => (
            <span key={s} className={s === 'Finishes' ? 'step active' : 'step'}>
              {s}
            </span>
          ))}
        </nav>
        <div className="units">
          {(['imperial', 'metric'] as const).map((u) => (
            <button key={u} className={units === u ? 'chip on' : 'chip'} onClick={() => set({ units: u })}>
              {u === 'imperial' ? 'ft/in' : 'mm'}
            </button>
          ))}
        </div>
      </header>

      <main className="viewport">
        <Canvas
          shadows="soft"
          flat
          dpr={[1, 2]}
          camera={{ position: [ROOM.width * 0.78, 1.75, ROOM.depth - 0.4], fov: 50, near: 0.02, far: 50 }}
          gl={{ antialias: false, preserveDrawingBuffer: true }}
        >
          <Suspense fallback={null}>
            <SpikeScene />
            {/* Inside the same Suspense so tracing starts only once the scene has loaded; keyed to restart on finish changes. */}
            {mode === 'photo' && (
              <PathTracer key={finishKey} onSamples={(n) => n !== useApp.getState().samples && set({ samples: n })} />
            )}
          </Suspense>
          <CameraRig mode={mode} />
          {mode === 'orbit' && (
            <OrbitControls makeDefault target={ORBIT_TARGET} maxPolarAngle={Math.PI * 0.55} minDistance={0.4} maxDistance={9} enableDamping />
          )}
          {mode === 'walk' && (
            <WalkControls
              eyeHeight={m(eyeHeight)}
              bounds={{ minX: 0.3, maxX: ROOM.width - 0.3, minZ: m(inches(24)) + 0.35, maxZ: ROOM.depth - 0.3 }}
            />
          )}
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

        <div className="toolbar">
          {(['orbit', 'walk', 'photo'] as const).map((v) => (
            <button key={v} className={mode === v ? 'tool on' : 'tool'} onClick={() => set({ mode: v, samples: 0 })}>
              {v === 'orbit' ? 'Orbit' : v === 'walk' ? 'Walk' : 'Photo'}
            </button>
          ))}
          {mode === 'walk' && (
            <label className="height">
              Eye height <strong>{formatLength(eyeHeight, units)}</strong>
              <input
                type="range"
                min={inches(36)}
                max={inches(80)}
                step={inches(0.5)}
                value={eyeHeight}
                onChange={(e) => set({ eyeHeight: Number(e.target.value) })}
              />
            </label>
          )}
          {mode === 'photo' && <span className="hint">{samples} samples — keep still to refine</span>}
        </div>
        {mode === 'walk' && <div className="walk-hint">Click the view to look around · WASD to walk · Esc to release the mouse</div>}
      </main>

      <FinishesPanel />
    </div>
  );
}
