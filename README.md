# StagePair

**One stage. Two collaborators.**

StagePair is a browser-native co-direction experiment built for the WebMCP Challenge. A person stages the performance; an agent works with the same live stage state to frame the shot.

The experience is intentionally small: one room, one performer, one table, one door, one camera. The point is not to generate more media. The point is to make human and agent actions meet inside the same persistent web scene.

## Core interaction

1. Click the stage floor to restage the performer.
2. Ask a WebMCP-capable agent to inspect the current stage.
3. The agent can evaluate and reposition the camera without changing the performance.
4. The viewfinder updates immediately from the same state.
5. Capture a still and compare the preserved performance with the changed camera.

## WebMCP tools

- `inspect_stage` — read the current stage, performer, props, locks, and revision.
- `inspect_camera` — read the current camera and framing target.
- `evaluate_camera` — deterministically check framing distance and simple table occlusion risk.
- `set_camera` — move the camera within the bounded stage while preserving locked creative state.
- `capture_take` — capture the current viewfinder as a contact-sheet still.

The tools are registered with the current imperative WebMCP API (`document.modelContext.registerTool`). In browsers without WebMCP, the full human-facing stage still works and the UI clearly reports that the agent surface is unavailable.

## Stack

- Vite
- React + TypeScript
- Three.js via React Three Fiber
- React Three Drei
- WebMCP imperative API

No external 3D assets or generated images are required for the core experience. The stage is procedural.

## Run

```bash
pnpm install
pnpm dev
```

Production build:

```bash
pnpm build
```

## License

MIT
