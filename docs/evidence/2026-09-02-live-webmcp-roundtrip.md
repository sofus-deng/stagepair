# StagePair live WebMCP roundtrip evidence — 2026-09-02

## Environment

- Public deployment: https://stagepair.netlify.app
- Browser: Chrome with WebMCP testing enabled
- Inspector: Model Context Tool Inspector Extension
- WebMCP status in page: `WEBMCP / LIVE · 5 TOOLS`

## Verified live sequence

1. `inspect_stage` returned live structured page state at revision 1, including performer, camera, table, door, creative locks, collaboration rule, and revision-bound handoff rule.
2. The human restaged the performer multiple times in the page, advancing the shared state to revision 4.
3. `set_camera` was invoked with stale `basedOnRevision: 1` and was rejected:
   - `ok: false`
   - `stale: true`
   - `basedOnRevision: 1`
   - `currentRevision: 4`
   - Pair Feed: `Stale R1 rejected · stage is now R4. Re-inspect first.`
4. After re-inspecting the latest state, `set_camera` was invoked with:
   - `x: 2.6`
   - `z: 4.2`
   - `fov: 38`
   - `basedOnRevision: 4`
5. The camera update succeeded and advanced the shared state to revision 5:
   - `ok: true`
   - Pair Feed: `R4 handed off → camera 2.6, 4.2 · 38°`
   - Agent Camera / Viewfinder visibly reframed the same live stage.
6. `capture_take` with label `Agent reframed` succeeded at revision 5:
   - `ok: true`
   - Pair Feed: `Agent reframed captured at revision 5`
   - Contact Sheet received the captured R5 frame.

## What this proves

The page and agent share one authoritative live stage state. A human edit invalidates an agent action based on an older revision; the agent must re-observe before it can mutate the camera. A successful agent camera action immediately changes the same page the human is viewing, and the result can be captured with its exact shared revision.

This is the core StagePair WebMCP proof:

`Human changes blocking → stale agent action is rejected → agent re-observes → agent reframes → shared result is captured.`

## Next validation

Run the same flow from a natural-language prompt in a WebMCP-capable agent host so the agent selects and sequences the tools without manual tool selection.
