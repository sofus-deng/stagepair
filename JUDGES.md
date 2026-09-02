# Judge path — StagePair

**One stage. Two collaborators.**

StagePair is designed to reveal its WebMCP idea in about one minute.

## Open

Use either:

- ChatGPT's in-app browser, which supports WebMCP for the challenge, or
- Google Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled and Chrome relaunched.

No login is required.

## 60-second path

### 1. Change the world as the human

Click the floor in **01 / LIVE STAGE** to move the performer.

Watch the shared revision advance in **02 / AGENT CAMERA** and **PAIR FEED**.

### 2. Give the agent the camera

Ask:

> Inspect the live stage. Find a closer shot that keeps the door relationship readable and avoids the table. Preserve the performance and props. Move only the camera, then capture the frame as “Agent B”.

The agent should discover these page-owned tools:

- `inspect_stage`
- `inspect_camera`
- `evaluate_camera`
- `set_camera`
- `capture_take`

A successful camera move should visibly glide the live viewfinder while leaving the stage itself intact.

### 3. Try the WebMCP-specific handoff

For the clearest proof, have the agent inspect the stage, then **move the performer again before its camera write**.

The old `set_camera` call must return `stale: true` because its `basedOnRevision` no longer matches the page's authoritative revision.

No camera mutation should occur.

The agent must call `inspect_stage` again, see the human's new blocking, and frame from that latest state.

### 4. Take back authority

Click **Camera** under CREATIVE LOCKS so it is locked.

An agent `set_camera` call against the current revision must return `locked: true` and leave the camera unchanged.

Unlock Camera to hand that creative surface back.

## What to notice

StagePair's WebMCP use is not a remote API hidden behind chat. The tools live on the page that owns the visual state the human is editing.

> **Human changes the world. Agent changes the view.**

The revision-bound handoff makes that collaboration testable: an old agent decision cannot silently overwrite a newer human edit.

## Reproducible code check

```bash
pnpm install
pnpm eval
pnpm check
pnpm build
```

`pnpm eval` invokes the same WebMCP tool registration module used by the app and verifies fresh handoff, stale rejection, and human Camera lock behavior.
