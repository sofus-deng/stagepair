# StagePair — WebMCP Challenge submission package

## Title

**StagePair**

## Tagline

**One stage. Two collaborators.**

## One-line pitch

A human stages the performance while an AI agent finds the shot — both working against the same live browser scene instead of regenerating the world.

## Short description

StagePair is a browser-native co-direction study for humans and AI agents. The human controls blocking inside a small persistent 3D stage. Through WebMCP, the agent reads that exact live stage state, evaluates camera positions, moves only the camera, and captures the resulting frame.

The key interaction is a revision-bound handoff. Every agent camera move must name the exact stage revision it inspected. If the human changes the scene first, the stale agent move is rejected and the agent must re-inspect the page before continuing. The result is a visible, testable creative handoff rather than two actors silently overwriting one another.

## Why this is better with WebMCP

Without WebMCP, an agent would need to infer the state of a visual 3D editor from screenshots or operate a separate remote API that may not reflect what the human just changed.

StagePair lets the page expose semantic tools directly from the live scene it owns. The agent sees the same performer position, camera, props, creative locks, and revision that the human is touching on screen. Human edits immediately become the agent's next source of truth.

This makes WebMCP part of the collaboration model, not just transport.

## What humans and agents do together

### Human

- Restages the performer directly in the 3D scene.
- Locks creative decisions that should not be changed.
- Marks frames worth keeping.

### Agent

- Inspects the exact current stage revision.
- Evaluates candidate camera positions.
- Moves only the camera while preserving performance and props.
- Re-inspects when a human edit invalidates stale context.
- Captures the shared frame into the contact sheet.

## WebMCP implementation

StagePair uses the imperative WebMCP API through `document.modelContext.registerTool`.

Tools:

- `inspect_stage`
- `inspect_camera`
- `evaluate_camera`
- `set_camera`
- `capture_take`

`set_camera` requires `basedOnRevision`, the exact revision returned by the agent's latest `inspect_stage` call. A human edit increments the shared revision, so stale mutations are rejected before they touch the camera.

Creative locks provide a second boundary: when the human locks Camera, agent camera mutation is rejected even with a current revision.

The page remains usable as a human 3D experience in browsers without WebMCP, while clearly reporting that the agent surface is unavailable.

## Stack

- React + TypeScript
- Vite
- Three.js
- React Three Fiber
- React Three Drei
- WebMCP imperative API

The scene is procedural and does not require external 3D assets or generated images.

## Evaluation

CI runs a small executable WebMCP handoff evaluation before TypeScript and production build checks.

It verifies:

1. All five tools register.
2. A fresh revision-bound camera handoff succeeds.
3. A human edit makes the prior agent revision stale.
4. The stale camera move is rejected without mutation.
5. A human Camera lock rejects agent mutation.

See `EVALUATION.md` for scoped claims and reproduction steps.

---

# Suggested 3-minute demo

## 0:00–0:18 — Hook

**Voiceover:**

> Most AI creative tools regenerate when you ask for another view. StagePair asks a different question: what if the human and the agent could simply stand in the same scene?

Show the complete StagePair interface immediately.

## 0:18–0:42 — Human hand

Move the performer on the live stage.

**Voiceover:**

> I own the blocking. The page now has a new authoritative revision.

Point out the revision in the viewfinder / Pair Feed.

## 0:42–1:20 — Agent eye

Ask the WebMCP-capable agent:

> Inspect the live stage. Find a closer shot that keeps the door relationship readable and avoids the table. Preserve the performance and props. Move only the camera, then capture the frame as “Agent B”.

Show the agent using `inspect_stage`, optionally `evaluate_camera`, then `set_camera`.

The viewfinder should glide to the new camera while the world stays fixed.

## 1:20–1:52 — The WebMCP moment

Have the agent inspect the stage, then move the performer **before** its next camera mutation.

The old `set_camera` call should return `stale: true`.

**Voiceover:**

> This is the important part. I changed the shared page after the agent looked. StagePair refuses to let an old agent decision overwrite my new blocking.

The agent re-inspects and adapts.

## 1:52–2:18 — Human authority

Lock Camera and let an agent camera move be rejected, then unlock it.

**Voiceover:**

> Shared does not mean uncontrolled. The human can lock a creative surface at any moment.

## 2:18–2:42 — Proof

Capture the resulting frame into the contact sheet.

Show:

- same room
- same props
- preserved performance decision
- changed camera
- exact shared revision

## 2:42–2:58 — Close

**Voiceover:**

> Human changes the world. Agent changes the view. One stage, two collaborators — StagePair.

End on the full interface and wordmark.

---

# Judging lens

## WebMCP Leverage

The agent operates the exact live browser state the human is editing, and revision-bound writes make interleaving observable and safe from stale overwrite.

## Execution

A working 3D stage, live viewfinder, bounded semantic tools, creative locks, contact-sheet evidence, deterministic evaluation, and production CI.

## Potential Impact

The same interaction pattern can apply to visual editors where humans set intent and agents explore the remaining solution space without rebuilding or flattening the shared state.

## Creativity & Ambition

StagePair treats an AI agent as another participant inside a persistent creative scene, not as a chat box that generates a replacement artifact.

---

# Final submission checklist

- [ ] Public live URL tested in a WebMCP-capable environment
- [x] Public source repository
- [x] OSI-style open-source license (MIT)
- [x] Build instructions
- [x] WebMCP implementation explanation
- [x] Deterministic collaboration evaluation
- [ ] Public YouTube demo under 3 minutes with audio
- [ ] Devpost description pasted and final links inserted
- [ ] Final submission version frozen after cutoff
