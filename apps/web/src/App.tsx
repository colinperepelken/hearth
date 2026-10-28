import { useEffect } from 'react';
import { formatLength, inches } from '@hearth/core';
import { CatalogPanel, DRAG_TYPE, ItemInspector } from './DesignPanels';
import { FinishesPanel } from './FinishesPanel';
import { PlanView, planDrop } from './PlanView';
import { RoomInspector, RoomToolsPanel } from './RoomPanels';
import { Scene3D, sceneDrop } from './Scene3D';
import { loadSaved, resetProject, room, useHearth, type Layout, type Step } from './doc';

const STEPS: [Step, string][] = [
  ['room', 'Room'],
  ['design', 'Design'],
  ['finishes', 'Finishes'],
];

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
      const s = useHearth.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection?.kind === 'item' || s.selection?.kind === 'opening') {
          e.preventDefault();
          s.deleteSelection();
        }
      } else if (e.key === 'Escape') {
        s.set({ calibration: null, moveUnderlay: false });
        s.select(null);
      } else if (e.key.toLowerCase() === 'r' && s.selection?.kind === 'item' && s.mode !== 'walk') {
        const id = s.selection.id;
        s.edit((p) => {
          const it = room(p).items.find((i) => i.id === id);
          if (it) it.rotation += Math.PI / 2;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function ViewToolbar() {
  const mode = useHearth((s) => s.mode);
  const eyeHeight = useHearth((s) => s.eyeHeight);
  const samples = useHearth((s) => s.samples);
  const units = useHearth((s) => s.project.units);
  const set = useHearth((s) => s.set);
  return (
    <>
      <div className="toolbar">
        {(['orbit', 'walk', 'photo'] as const).map((v) => (
          <button key={v} className={mode === v ? 'tool on' : 'tool'} onClick={() => set({ mode: v, samples: 0 })}>
            {v === 'orbit' ? 'Orbit' : v === 'walk' ? 'Walk' : 'Photo'}
          </button>
        ))}
        {mode === 'walk' && (
          <label className="height">
            Eye height <strong>{formatLength(eyeHeight, units)}</strong>
            <input type="range" min={inches(36)} max={inches(80)} step={inches(0.5)} value={eyeHeight} onChange={(e) => set({ eyeHeight: Number(e.target.value) })} />
          </label>
        )}
        {mode === 'photo' && <span className="hint">{samples} samples — keep still to refine</span>}
      </div>
      {mode === 'walk' && <div className="walk-hint">Click the view to look around · WASD to walk · Esc to release the mouse</div>}
    </>
  );
}

function Viewport() {
  const step = useHearth((s) => s.step);
  const layout = useHearth((s) => s.layout);
  const set = useHearth((s) => s.set);
  const showPlan = layout !== '3d';
  const show3d = layout !== 'plan';

  const onDrop = (which: 'plan' | '3d') => (e: React.DragEvent) => {
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    const p = which === 'plan' ? planDrop.toPlan?.(e.clientX, e.clientY) : sceneDrop.toPlan?.(e.clientX, e.clientY);
    useHearth.getState().addItem(id, p ?? undefined);
  };
  const allowDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
  };

  return (
    <main className={`viewport layout-${layout}`}>
      {showPlan && (
        <div className="pane plan-pane" onDragOver={allowDrop} onDrop={onDrop('plan')}>
          <PlanView editable={step === 'room' ? 'room' : 'design'} />
        </div>
      )}
      {show3d && (
        <div className="pane scene-pane" onDragOver={allowDrop} onDrop={onDrop('3d')}>
          <Scene3D />
          <ViewToolbar />
        </div>
      )}
      <div className="layout-switch">
        {(
          [
            ['plan', 'Plan'],
            ['split', 'Split'],
            ['3d', '3D'],
          ] as [Layout, string][]
        ).map(([l, label]) => (
          <button key={l} className={layout === l ? 'chip on' : 'chip'} onClick={() => set({ layout: l })}>
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}

export function App() {
  const step = useHearth((s) => s.step);
  const units = useHearth((s) => s.project.units);
  const canUndo = useHearth((s) => s.past.length > 0);
  const canRedo = useHearth((s) => s.future.length > 0);
  const loaded = useHearth((s) => s.loaded);
  const { set, undo, redo, edit, select } = useHearth.getState();
  useShortcuts();
  useEffect(() => void loadSaved(), []);

  if (!loaded) return null;

  return (
    <div className={`app step-${step}`}>
      <header className="topbar">
        <div className="brand">Hearth</div>
        <div className="history">
          <button className="chip" disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">
            Undo
          </button>
          <button className="chip" disabled={!canRedo} onClick={redo} title="Redo (⇧⌘Z)">
            Redo
          </button>
        </div>
        <nav className="stepper">
          {STEPS.map(([id, label], i) => (
            <button
              key={id}
              className={step === id ? 'step active' : 'step'}
              onClick={() => {
                select(null);
                set({ step: id, layout: id === 'room' ? 'split' : '3d', calibration: null, moveUnderlay: false, mode: 'orbit' });
              }}
            >
              <span className="num">{i + 1}</span> {label}
            </button>
          ))}
        </nav>
        <div className="units">
          {(['imperial', 'metric'] as const).map((u) => (
            <button key={u} className={units === u ? 'chip on' : 'chip'} onClick={() => edit((p) => void (p.units = u))}>
              {u === 'imperial' ? 'ft/in' : 'mm'}
            </button>
          ))}
          <button className="chip" onClick={() => confirm('Start over with the sample kitchen? This replaces your current design.') && resetProject()}>
            Reset
          </button>
        </div>
      </header>

      {step === 'room' && <RoomToolsPanel />}
      {step === 'design' && <CatalogPanel />}
      <Viewport />
      {step === 'room' && <RoomInspector />}
      {step === 'design' && <ItemInspector />}
      {step === 'finishes' && <FinishesPanel />}
    </div>
  );
}
