# StagePair

**One stage. Two collaborators.**

StagePair is a browser-native co-direction study built for the WebMCP Challenge. A person stages the performance; an agent works with the **same live stage state** to frame the shot.

The experience is intentionally small: one room, one performer, one table, one door, one camera. The point is not to generate more media. The point is to make human and agent actions meet inside the same persistent web scene.

> Human changes the world. Agent changes the view.

## Why WebMCP matters here

StagePair is not a chat wrapper around a remote 3D API. The WebMCP tools are registered by the page that owns the scene, and they read or mutate the exact state the human is touching on screen.

The key collaboration primitive is a **revision-bound handoff**:

1. The agent calls `inspect_stage` and sees revision `R7`.
2. The human can restage the performer, advancing the shared scene to `R8`.
3. If the agent tries to apply a camera move based on `R7`, `set_camera` rejects it as stale.
4. The agent must inspect the page again, see the human's latest edit, and reframe from `R8`.

That makes interleaving visible and testable: neither collaborator silently overwrites the other's latest creative decision.

## Core interaction

1. Click the stage floor to restage the performer.
2. Ask a WebMCP-capable agent to inspect the current stage.
3. The agent evaluates a shot against the live performer, table, door, locks, and revision.
4. The agent repositions only the camera, bound to the exact revision it inspected.
5. The viewfinder updates from the same shared scene.
6. Restage again and let the agent adapt to the new truth.
7. Capture a still into the contact sheet with its exact revision.

## WebMCP tools

- `inspect_stage` — read performer, camera, props, creative locks, and the authoritative revision.
- `inspect_camera` — read the current camera and deterministic framing evaluation.
- `evaluate_camera` — evaluate a candidate shot without mutating the stage.
- `set_camera` — move only the camera; requires the exact latest `basedOnRevision` and rejects stale or human-locked moves.
- `capture_take` — capture the current viewfinder as a contact-sheet still.

The tools use the current imperative WebMCP API (`document.modelContext.registerTool`). Registration is lifecycle-bound with `AbortSignal`. In browsers without WebMCP, the human-facing stage still works and the UI clearly reports that the agent surface is unavailable.

## Suggested demo prompt

After moving the performer, ask your WebMCP agent:

> Inspect the live stage. Find a closer shot that keeps the door relationship readable and avoids the table. Preserve the performance and props. Move only the camera, then capture the frame as “Agent B”.

Then move the performer again while the agent is working and ask it to continue. A stale move must be rejected; the agent should re-inspect and adapt.

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

Production verification:

```bash
pnpm check
pnpm build
```

See [`EVALUATION.md`](./EVALUATION.md) for the small deterministic collaboration checks used by the demo.

## License

MIT
