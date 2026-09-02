export type StagePoint = { x: number; z: number }

export type StageSnapshot = {
  revision: number
  performer: StagePoint
  camera: StagePoint & { fov: number }
  table: StagePoint & { width: number; depth: number }
  door: StagePoint
  locks: {
    performance: boolean
    performer: boolean
    prop: boolean
    camera: boolean
  }
}

export type AgentAction = {
  label: string
  detail: string
}

type ModelContextTool = {
  name: string
  title?: string
  description: string
  inputSchema?: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ) => Promise<unknown> | unknown
}

type ModelContextRegisterOptions = {
  signal?: AbortSignal
  exposedTo?: string[]
}

type StagePairModelContext = {
  registerTool: (tool: ModelContextTool, options?: ModelContextRegisterOptions) => Promise<void>
}

declare global {
  interface Document {
    modelContext?: StagePairModelContext
  }
}

export type StagePairToolBridge = {
  getSnapshot: () => StageSnapshot
  setCamera: (camera: StagePoint & { fov: number }) => StageSnapshot
  captureTake: (label: string) => Promise<{ id: string; revision: number }>
  onAgentAction: (action: AgentAction) => void
}

const CAMERA_LIMIT = 7.2
const MIN_FOV = 28
const MAX_FOV = 68

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const asFiniteNumber = (value: unknown, field: string) => {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${field} must be a finite number.`)
  return number
}

const distance = (a: StagePoint, b: StagePoint) => Math.hypot(a.x - b.x, a.z - b.z)

function pointToSegmentDistance(point: StagePoint, start: StagePoint, end: StagePoint) {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared === 0) return distance(point, start)
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1)
  return distance(point, { x: start.x + t * dx, z: start.z + t * dz })
}

export function evaluateCamera(snapshot: StageSnapshot, camera: StagePoint & { fov: number }) {
  const subjectDistance = distance(camera, snapshot.performer)
  const tableDistanceToSightline = pointToSegmentDistance(
    snapshot.table,
    camera,
    snapshot.performer,
  )
  const tableIsBetween =
    distance(camera, snapshot.table) < subjectDistance &&
    distance(snapshot.table, snapshot.performer) < subjectDistance
  const occlusionRisk = tableIsBetween && tableDistanceToSightline < Math.max(snapshot.table.width, snapshot.table.depth) * 0.62

  const framing = subjectDistance < 2.2 ? 'very-close' : subjectDistance < 3.8 ? 'close' : subjectDistance < 5.7 ? 'medium' : 'wide'
  const doorVisibleFromSide = Math.abs(camera.x - snapshot.door.x) > 1.2

  return {
    subjectDistance: Number(subjectDistance.toFixed(2)),
    framing,
    tableOcclusionRisk: occlusionRisk,
    doorLikelyReadable: doorVisibleFromSide,
    notes: [
      occlusionRisk ? 'The table sits close to the camera-to-performer sightline.' : 'No simple table occlusion risk detected.',
      doorVisibleFromSide ? 'The camera has enough lateral separation to keep the door relationship legible.' : 'A more lateral camera position may make the door relationship clearer.',
    ],
  }
}

export function hasWebMCP() {
  return typeof document !== 'undefined' && Boolean(document.modelContext?.registerTool)
}

export async function registerStagePairTools(bridge: StagePairToolBridge) {
  if (!document.modelContext?.registerTool) return () => undefined

  const controllers: AbortController[] = []
  const register = async (tool: ModelContextTool) => {
    const controller = new AbortController()
    controllers.push(controller)
    await document.modelContext!.registerTool(tool, { signal: controller.signal })
  }

  await register({
    name: 'inspect_stage',
    title: 'Inspect the live stage',
    description:
      'Read the exact current StagePair state: performer, camera, table, door, creative locks, and revision. Use this before proposing a shot so you work from the human’s latest edit.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ...bridge.getSnapshot(),
      collaborationRule: 'Preserve locked creative state. Camera is the agent-owned creative surface unless the UI says otherwise.',
    }),
  })

  await register({
    name: 'inspect_camera',
    title: 'Inspect the current camera',
    description:
      'Read the current camera position, field of view, performer target, and a deterministic framing check against the current live stage.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const snapshot = bridge.getSnapshot()
      return {
        revision: snapshot.revision,
        camera: snapshot.camera,
        target: snapshot.performer,
        evaluation: evaluateCamera(snapshot, snapshot.camera),
      }
    },
  })

  await register({
    name: 'evaluate_camera',
    title: 'Evaluate a camera position',
    description:
      'Evaluate a candidate camera position against the current performer, table, and door without mutating the stage. Useful before choosing a new shot.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Camera X position in stage meters, from -7.2 to 7.2.' },
        z: { type: 'number', description: 'Camera Z position in stage meters, from -7.2 to 7.2.' },
        fov: { type: 'number', description: 'Vertical field of view in degrees, from 28 to 68.' },
      },
      required: ['x', 'z'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const snapshot = bridge.getSnapshot()
      const camera = {
        x: clamp(asFiniteNumber(input.x, 'x'), -CAMERA_LIMIT, CAMERA_LIMIT),
        z: clamp(asFiniteNumber(input.z, 'z'), -CAMERA_LIMIT, CAMERA_LIMIT),
        fov: clamp(input.fov === undefined ? snapshot.camera.fov : asFiniteNumber(input.fov, 'fov'), MIN_FOV, MAX_FOV),
      }
      return { revision: snapshot.revision, candidate: camera, evaluation: evaluateCamera(snapshot, camera) }
    },
  })

  await register({
    name: 'set_camera',
    title: 'Set the camera',
    description:
      'Move only the camera in the live StagePair scene. This tool never moves the performer, prop, or performance. It rejects the action if the human has locked the camera.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Camera X position in stage meters, from -7.2 to 7.2.' },
        z: { type: 'number', description: 'Camera Z position in stage meters, from -7.2 to 7.2.' },
        fov: { type: 'number', description: 'Vertical field of view in degrees, from 28 to 68.' },
      },
      required: ['x', 'z'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input, { signal }) => {
      if (signal.aborted) throw new DOMException('Camera action cancelled.', 'AbortError')
      const snapshot = bridge.getSnapshot()
      if (snapshot.locks.camera) throw new Error('Camera is locked by the human. No camera change was made.')

      const nextCamera = {
        x: clamp(asFiniteNumber(input.x, 'x'), -CAMERA_LIMIT, CAMERA_LIMIT),
        z: clamp(asFiniteNumber(input.z, 'z'), -CAMERA_LIMIT, CAMERA_LIMIT),
        fov: clamp(input.fov === undefined ? snapshot.camera.fov : asFiniteNumber(input.fov, 'fov'), MIN_FOV, MAX_FOV),
      }
      const next = bridge.setCamera(nextCamera)
      bridge.onAgentAction({
        label: 'AGENT / CAMERA',
        detail: `Camera moved to ${nextCamera.x.toFixed(1)}, ${nextCamera.z.toFixed(1)} · ${Math.round(nextCamera.fov)}°`,
      })
      return {
        ok: true,
        revision: next.revision,
        camera: next.camera,
        preserved: ['performer', 'performance', 'table', 'door'],
        evaluation: evaluateCamera(next, next.camera),
      }
    },
  })

  await register({
    name: 'capture_take',
    title: 'Capture the current frame',
    description:
      'Capture the current StagePair viewfinder as a contact-sheet still, preserving the exact current stage revision and camera state.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'A short optional take label.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 32) : 'Agent take'
      const result = await bridge.captureTake(label)
      bridge.onAgentAction({ label: 'AGENT / TAKE', detail: `${label} captured at revision ${result.revision}` })
      return { ok: true, ...result }
    },
  })

  return () => controllers.forEach((controller) => controller.abort())
}
