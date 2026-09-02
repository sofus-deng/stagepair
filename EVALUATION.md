# StagePair evaluation

StagePair keeps its evaluation intentionally small and scoped to the collaboration claim made by the demo.

## Claim under test

A human and an agent can interleave edits against one authoritative browser scene without the agent silently acting on stale stage state.

## Deterministic checks

| Check | Expected result |
| --- | --- |
| Fresh handoff | `inspect_stage` returns revision `Rn`; `set_camera(..., basedOnRevision: Rn)` succeeds if the camera is unlocked. |
| Stale handoff | Human restaging advances `Rn → Rn+1`; a `set_camera` call still based on `Rn` returns `stale: true` and does not mutate the camera. |
| Re-inspection | After a stale rejection, a new `inspect_stage` exposes the human's latest performer position and current revision. |
| Creative lock | When Camera is locked in the page UI, `set_camera` returns `locked: true` and does not mutate the camera. |
| Bounded authorship | A successful `set_camera` changes only camera position/FOV; performer, performance, table, and door are reported as preserved. |
| Read-before-write | `evaluate_camera` is read-only and can evaluate a candidate against the current stage before mutation. |
| Evidence | `capture_take` stores the viewfinder still together with the exact shared revision used for that frame. |
| Progressive enhancement | Without WebMCP support, the human 3D stage remains usable and clearly reports the missing agent surface. |

## Demo stress case

1. Human moves the performer.
2. Agent calls `inspect_stage` and records the returned revision.
3. Before the agent commits its shot, human moves the performer again.
4. Agent calls `set_camera` with the old revision.
5. StagePair must reject the move as stale.
6. Agent calls `inspect_stage` again and finds a new shot from the latest scene.

This evaluation does **not** claim generalized agent safety, cinematographic quality, or multi-user concurrency correctness. It only validates the bounded StagePair handoff demonstrated by this submission.
