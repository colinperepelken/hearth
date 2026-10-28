# Hearth — plan

Hearth is a browser-based home design tool. It starts as a kitchen planner, used locally for one renovation, but its data model and code layout are built for whole-house design and a hosted, multi-user product later.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Platform | Web app (desktop browsers) | Shareable later, no install, accounts/backend slot in cleanly. Tauri can wrap it as a Mac app if ever needed. |
| 3D | Three.js + React Three Fiber | Largest ecosystem, PBR materials, good tooling. WebGL2 now; move to `WebGPURenderer` once our post-processing stack supports it. |
| Realism | PBR materials, indoor HDRI, soft shadows, N8AO ambient occlusion, AgX tone mapping, SMAA | Lighting and materials drive realism more than geometry. |
| Photo mode | `three-gpu-pathtracer` progressive path tracing of the current view | Near-photoreal stills from the same scene, no separate pipeline. |
| UI | React + TypeScript + Vite, Zustand state | Simple, fast, well known. |
| Units | Store millimetres internally; display ft/in (default) or metric | One source of truth, exact conversion at the edges. |
| Persistence | IndexedDB, versioned JSON schema | A backend later only needs to sync the same documents. |
| Cabinets | Generated from parameters (width/height/depth/style), not fixed models | Every standard size and custom sizes for free; framed and frameless systems. |
| Appliances | Catalog entries with real Canadian SKUs and dimensions; simple procedural models first, GLB models later | Accurate fit matters more than perfect looks early on. |
| Paint | Hex input plus named colours (Benjamin Moore, Sherwin-Williams) matched by nearest colour | Manufacturer hex values are approximations; matching by name is what users want. |

## Repo layout

```
hearth/
  apps/web/            the app (UI, wizard, panels)
  packages/core/       units, geometry, document model, commands (no React, no Three)
  packages/catalog/    cabinets, appliances, furniture, finishes, paints   (later)
  packages/renderer/   R3F scene: room, cabinets, materials, lighting, cameras
```

## Document model

```
Project
  └─ Building
       └─ Level (floor)
            └─ Room (type: kitchen | bathroom | … )
                 ├─ Walls (polyline segments, thickness, height)
                 │    └─ Openings (door, window, pass-through)
                 ├─ Surfaces (floor, ceiling, wall finishes)
                 └─ Items (catalog ref + transform + options)
```

Every change goes through a command (`addItem`, `moveWall`, …) so undo/redo, autosave and future sync come for free. The kitchen is one room type with its own tools and catalog; other rooms plug in the same way.

## UI

- **Top:** stepper — Room → Cabinets → Appliances → Finishes → Furnish → Review (any step reachable at any time).
- **Left:** catalog for the current step, with search and filters; drag into the scene.
- **Centre:** viewport with 2D plan / 3D / split; floating camera controls (Orbit · Walk · Photo) and eye-height slider in Walk.
- **Right:** inspector for the selection — exact dimensions, position, finish options.

## Phases

1. **Rendering spike** — one wall of shaker cabinets, counter, backsplash, window, floor; orbit, walk, photo mode. Goal: confirm the browser looks realistic enough.
2. **Room** — wizard (rectangle / L / U / custom, or upload a PNG/JPEG floorplan), two-point scale calibration, trace and drag walls, exact ft/in input, doors/windows, ceiling height.
3. **Cabinets** — base, wall, tall, corner, sink, drawer, pantry; framed or frameless; snapping and auto fillers; islands and peninsulas.
4. **3D experience** — 2D/3D/split, elevations, walk mode with wall collision.
5. **Appliances and furniture** — ranges, cooktops, wall ovens, fridges, dishwashers, microwaves (incl. over-the-range combos), hoods, sinks, faucets, stools, tables, lighting; Canadian availability.
6. **Finishes** — door styles, hardware style and finish, cabinet and wall paint (hex or paint name), flooring, countertops and edges, backsplash.
7. **Smarts** — NKBA clearance warnings, work triangle, door-swing collisions, parts list.

## Later

- Pricing in the parts list.
- Photo-based custom textures for floors and counters.
- Backend: Google sign-in, saved projects, sharing.
- Whole-house: multiple rooms and levels.
- AI image generation, if photo mode isn't enough.
