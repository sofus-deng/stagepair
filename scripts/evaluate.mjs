import assert from 'node:assert/strict'
import { registerStagePairTools } from '../src/webmcp.ts'

const tools = new Map()
globalThis.document = {
  modelContext: {
    async registerTool(tool) {
      tools.set(tool.name, tool)
    },
  },
}

let stage = {
  revision: 1,
  performer: { x: 0.4, z: -0.45 },
  camera: { x: 4.9, z: 4.7, fov: 43 },
  table: { x: -0.8, z: 0.9, width: 2.25, depth: 1.15 },
  door: { x: 3.25, z: -4.82 },
  locks: { performance: true, performer: false, prop: true, camera: false },
}

const actions = []
const cleanup = await registerStagePairTools({
  getSnapshot: () => stage,
  setCamera: (camera) => {
    stage = { ...stage, revision: stage.revision + 1, camera }
    return stage
  },
  captureTake: async () => ({ id: 'take-eval', revision: stage.revision }),
  onAgentAction: (action) => actions.push(action),
})

assert.equal(tools.size, 5, 'all five WebMCP tools should register')

const inspected = await tools.get('inspect_stage').execute({})
assert.equal(inspected.revision, 1)

const fresh = await tools.get('set_camera').execute({
  x: 3.8,
  z: 3.4,
  fov: 39,
  basedOnRevision: inspected.revision,
})
assert.equal(fresh.ok, true, 'fresh revision handoff should succeed')
assert.equal(stage.revision, 2)
assert.deepEqual(stage.camera, { x: 3.8, z: 3.4, fov: 39 })

const cameraBeforeHumanEdit = { ...stage.camera }
stage = {
  ...stage,
  revision: 3,
  performer: { x: -1.2, z: 0.4 },
}

const stale = await tools.get('set_camera').execute({
  x: 2.2,
  z: 2.8,
  fov: 36,
  basedOnRevision: 2,
})
assert.equal(stale.ok, false)
assert.equal(stale.stale, true, 'agent move based on pre-human-edit state must be rejected')
assert.deepEqual(stage.camera, cameraBeforeHumanEdit, 'stale move must not mutate camera')

stage = {
  ...stage,
  revision: 4,
  locks: { ...stage.locks, camera: true },
}

const locked = await tools.get('set_camera').execute({
  x: 1.8,
  z: 2.2,
  basedOnRevision: 4,
})
assert.equal(locked.ok, false)
assert.equal(locked.locked, true, 'human camera lock must reject agent mutation')
assert.deepEqual(stage.camera, cameraBeforeHumanEdit, 'locked move must not mutate camera')

assert.ok(actions.some((action) => action.label === 'AGENT / HANDOFF'))
assert.ok(actions.some((action) => action.label === 'AGENT / LOCK'))

cleanup()
console.log('StagePair eval: 5 tools registered; fresh, stale, and lock handoffs verified.')
