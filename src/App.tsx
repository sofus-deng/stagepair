import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Line, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import {
  hasWebMCP,
  registerStagePairTools,
  type AgentAction,
  type StagePoint,
  type StageSnapshot,
} from './webmcp'

const initialStage: StageSnapshot = {
  revision: 1,
  performer: { x: 0.4, z: -0.45 },
  camera: { x: 4.9, z: 4.7, fov: 43 },
  table: { x: -0.8, z: 0.9, width: 2.25, depth: 1.15 },
  door: { x: 3.25, z: -4.82 },
  locks: {
    performance: true,
    performer: false,
    prop: true,
    camera: false,
  },
}

type FeedEntry = {
  id: string
  actor: 'HUMAN' | 'AGENT' | 'SYSTEM'
  label: string
  detail: string
  revision: number
}

type TakeStill = {
  id: string
  label: string
  image: string
  revision: number
  camera: StageSnapshot['camera']
  performer: StageSnapshot['performer']
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

function useLookAt(
  ref: React.RefObject<THREE.Object3D | null>,
  position: StagePoint,
  target: StagePoint,
  targetY = 1.35,
) {
  useLayoutEffect(() => {
    const object = ref.current
    if (!object) return
    object.position.set(position.x, 1.62, position.z)
    object.lookAt(target.x, targetY, target.z)
  }, [position.x, position.z, ref, target.x, target.z, targetY])
}

function Performer({ point }: { point: StagePoint }) {
  return (
    <group position={[point.x, 0, point.z]}>
      <mesh castShadow position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.31, 0.46, 1.48, 20]} />
        <meshStandardMaterial color="#db4935" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[-0.35, 1.38, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.12, 0.92, 0.13]} />
        <meshStandardMaterial color="#ca3f2e" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.35, 1.38, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.12, 0.92, 0.13]} />
        <meshStandardMaterial color="#ca3f2e" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 2.03, 0]}>
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial color="#242321" roughness={0.98} />
      </mesh>
      <mesh receiveShadow position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.56, 48]} />
        <meshBasicMaterial color="#db4935" transparent opacity={0.64} />
      </mesh>
      <mesh receiveShadow position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.82, 0.028]} />
        <meshBasicMaterial color="#db4935" transparent opacity={0.72} />
      </mesh>
    </group>
  )
}

function Table({ stage }: { stage: StageSnapshot }) {
  return (
    <group position={[stage.table.x, 0, stage.table.z]}>
      <mesh castShadow receiveShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[stage.table.width, 0.1, stage.table.depth]} />
        <meshStandardMaterial color="#242321" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[-0.72, 0.38, 0]}>
        <boxGeometry args={[0.1, 0.76, 0.78]} />
        <meshStandardMaterial color="#242321" roughness={0.84} />
      </mesh>
      <mesh castShadow position={[0.72, 0.38, 0]}>
        <boxGeometry args={[0.1, 0.76, 0.78]} />
        <meshStandardMaterial color="#242321" roughness={0.84} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.18, 0.845, 0.08]} rotation={[-Math.PI / 2, 0, -0.18]}>
        <planeGeometry args={[0.66, 0.44]} />
        <meshStandardMaterial color="#e8e2d7" roughness={0.96} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.16, 0.851, -0.08]} rotation={[-Math.PI / 2, 0, 0.08]}>
        <planeGeometry args={[0.62, 0.4]} />
        <meshStandardMaterial color="#dcd4c7" roughness={0.96} />
      </mesh>
    </group>
  )
}

function CameraObject({ stage }: { stage: StageSnapshot }) {
  const group = useRef<THREE.Group>(null)
  useLookAt(group, stage.camera, stage.performer)

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[0.44, 0.32, 0.68]} />
        <meshStandardMaterial color="#191817" roughness={0.44} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0, 0.47]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.22, 0.35, 20]} />
        <meshStandardMaterial color="#d9462f" roughness={0.38} />
      </mesh>
      <mesh position={[0, -1.58, 0]}>
        <cylinderGeometry args={[0.028, 0.055, 2.75, 12]} />
        <meshStandardMaterial color="#191817" />
      </mesh>
    </group>
  )
}

function ViewfinderCamera({ stage }: { stage: StageSnapshot }) {
  const camera = useRef<THREE.PerspectiveCamera>(null)
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const targetCamera = useMemo(() => new THREE.PerspectiveCamera(), [])

  useLayoutEffect(() => {
    if (!camera.current) return
    camera.current.position.set(stage.camera.x, 1.62, stage.camera.z)
    camera.current.lookAt(stage.performer.x, 1.35, stage.performer.z)
    camera.current.fov = stage.camera.fov
    camera.current.updateProjectionMatrix()
  }, [])

  useFrame((_, delta) => {
    const current = camera.current
    if (!current) return

    const positionAlpha = 1 - Math.exp(-7.5 * delta)
    const rotationAlpha = 1 - Math.exp(-9 * delta)
    const lensAlpha = 1 - Math.exp(-8 * delta)

    targetPosition.set(stage.camera.x, 1.62, stage.camera.z)
    current.position.lerp(targetPosition, positionAlpha)

    targetCamera.position.copy(current.position)
    targetCamera.lookAt(stage.performer.x, 1.35, stage.performer.z)
    targetQuaternion.copy(targetCamera.quaternion)
    current.quaternion.slerp(targetQuaternion, rotationAlpha)

    current.fov = THREE.MathUtils.lerp(current.fov, stage.camera.fov, lensAlpha)
    current.updateProjectionMatrix()
  })

  return <PerspectiveCamera ref={camera} makeDefault near={0.1} far={45} />
}

function FloorTape({ x, z, rotation = 0, length = 0.72 }: { x: number; z: number; rotation?: number; length?: number }) {
  return (
    <mesh position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[length, 0.035]} />
      <meshBasicMaterial color="#d9462f" transparent opacity={0.55} />
    </mesh>
  )
}

function StageArchitecture({ door }: { door: StagePoint }) {
  return (
    <>
      <mesh receiveShadow position={[-3.85, 2.45, -4.72]} rotation={[0, 0.16, 0]}>
        <boxGeometry args={[2.2, 4.35, 0.12]} />
        <meshStandardMaterial color="#bdb5a9" roughness={0.98} />
      </mesh>
      <mesh receiveShadow position={[-3.12, 2.4, -4.61]} rotation={[0, 0.16, 0]}>
        <boxGeometry args={[0.09, 3.1, 0.16]} />
        <meshStandardMaterial color="#d9462f" roughness={0.9} />
      </mesh>

      <group position={[door.x, 0, door.z]}>
        <mesh castShadow position={[-0.78, 1.65, 0]}>
          <boxGeometry args={[0.12, 3.3, 0.16]} />
          <meshStandardMaterial color="#1f1e1c" roughness={0.82} />
        </mesh>
        <mesh castShadow position={[0.78, 1.65, 0]}>
          <boxGeometry args={[0.12, 3.3, 0.16]} />
          <meshStandardMaterial color="#1f1e1c" roughness={0.82} />
        </mesh>
        <mesh castShadow position={[0, 3.24, 0]}>
          <boxGeometry args={[1.68, 0.12, 0.16]} />
          <meshStandardMaterial color="#1f1e1c" roughness={0.82} />
        </mesh>
        <mesh receiveShadow position={[0, 1.65, -0.055]}>
          <planeGeometry args={[1.48, 3.05]} />
          <meshStandardMaterial color="#a9a197" roughness={0.98} />
        </mesh>
        <mesh position={[-0.58, 1.62, 0.09]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#d9462f" />
        </mesh>
      </group>

      <mesh castShadow receiveShadow position={[4.45, 1.72, -2.45]} rotation={[0, -0.52, -0.04]}>
        <boxGeometry args={[1.35, 3.45, 0.11]} />
        <meshStandardMaterial color="#2a2825" roughness={0.92} />
      </mesh>

      <FloorTape x={-2.65} z={-1.72} rotation={0.18} length={1.05} />
      <FloorTape x={1.82} z={1.7} rotation={-0.72} length={0.86} />
      <FloorTape x={2.95} z={-2.25} rotation={0.08} length={0.58} />
    </>
  )
}

function HoverMark({ point }: { point: StagePoint }) {
  return (
    <group position={[point.x, 0.025, point.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.37, 48]} />
        <meshBasicMaterial color="#d9462f" transparent opacity={0.72} />
      </mesh>
      <Line points={[[-0.46, 0, 0], [0.46, 0, 0]]} color="#d9462f" lineWidth={0.7} transparent opacity={0.5} />
      <Line points={[[0, 0, -0.46], [0, 0, 0.46]]} color="#d9462f" lineWidth={0.7} transparent opacity={0.5} />
    </group>
  )
}

function StageSet({ stage, interactive, onMovePerformer }: {
  stage: StageSnapshot
  interactive?: boolean
  onMovePerformer?: (point: StagePoint) => void
}) {
  const [hoverPoint, setHoverPoint] = useState<StagePoint | null>(null)

  const boundedPoint = (event: ThreeEvent<PointerEvent>) => ({
    x: clamp(event.point.x, -3.8, 3.8),
    z: clamp(event.point.z, -3.6, 3.6),
  })

  const onFloorPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive || !onMovePerformer) return
    event.stopPropagation()
    onMovePerformer(boundedPoint(event))
  }

  const onFloorPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    event.stopPropagation()
    setHoverPoint(boundedPoint(event))
  }

  return (
    <>
      <color attach="background" args={['#d8d1c6']} />
      <fog attach="fog" args={['#d8d1c6', 9, 22]} />
      <ambientLight intensity={1.32} />
      <directionalLight
        castShadow
        position={[-3.8, 7.5, 4.8]}
        intensity={3.05}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <spotLight position={[4.5, 5.8, -1.5]} intensity={42} angle={0.38} penumbra={0.9} color="#ffe9c6" />
      <spotLight position={[-4.1, 4.8, -2.6]} intensity={18} angle={0.5} penumbra={1} color="#d9e0df" />

      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onFloorPointerDown}
        onPointerMove={onFloorPointerMove}
        onPointerLeave={() => setHoverPoint(null)}
      >
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#eee9df" roughness={0.94} />
      </mesh>
      <gridHelper args={[16, 16, '#bcb4a8', '#d9d2c6']} position={[0, 0.008, 0]} />

      <mesh receiveShadow position={[0, 2.65, -5]}>
        <boxGeometry args={[12, 5.3, 0.16]} />
        <meshStandardMaterial color="#c9c1b6" roughness={0.99} />
      </mesh>
      <mesh receiveShadow position={[-5.9, 2.65, 0]}>
        <boxGeometry args={[0.16, 5.3, 10]} />
        <meshStandardMaterial color="#d0c8bd" roughness={0.99} />
      </mesh>

      <StageArchitecture door={stage.door} />
      <Table stage={stage} />
      <Performer point={stage.performer} />
      {interactive && hoverPoint && !stage.locks.performer ? <HoverMark point={hoverPoint} /> : null}

      <ContactShadows position={[0, 0.012, 0]} scale={14} blur={2.7} opacity={0.32} far={5.5} />
    </>
  )
}

function DirectorStage({ stage, onMovePerformer }: {
  stage: StageSnapshot
  onMovePerformer: (point: StagePoint) => void
}) {
  return (
    <Canvas shadows camera={{ position: [7.6, 6.6, 8.4], fov: 42 }} dpr={[1, 1.75]}>
      <StageSet stage={stage} interactive onMovePerformer={onMovePerformer} />
      <Line
        points={[
          [stage.camera.x, 0.055, stage.camera.z],
          [stage.performer.x, 0.055, stage.performer.z],
        ]}
        color="#d9462f"
        lineWidth={0.8}
        transparent
        opacity={0.34}
        dashed
        dashScale={2.8}
        dashSize={0.35}
        gapSize={0.28}
      />
      <CameraObject stage={stage} />
      <OrbitControls
        makeDefault
        target={[0, 0.8, -0.45]}
        enablePan={false}
        minPolarAngle={0.64}
        maxPolarAngle={1.25}
        minDistance={7.2}
        maxDistance={13.5}
        dampingFactor={0.08}
      />
    </Canvas>
  )
}

function Viewfinder({ stage }: { stage: StageSnapshot }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <ViewfinderCamera stage={stage} />
      <StageSet stage={stage} />
    </Canvas>
  )
}

function LockButton({ locked, children, onClick }: {
  locked: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button className={`lock-chip ${locked ? 'is-locked' : ''}`} onClick={onClick} type="button">
      <span aria-hidden="true">{locked ? '●' : '○'}</span>
      {children}
    </button>
  )
}

export default function App() {
  const [stage, setStage] = useState(initialStage)
  const stageRef = useRef(stage)
  const [takes, setTakes] = useState<TakeStill[]>([])
  const [mcpStatus, setMcpStatus] = useState<'checking' | 'live' | 'unavailable' | 'error'>('checking')
  const [feed, setFeed] = useState<FeedEntry[]>([
    {
      id: uid(),
      actor: 'SYSTEM',
      label: 'PAIR / READY',
      detail: 'Human stages the performer. Agent frames the camera. Every handoff is revision-bound.',
      revision: 1,
    },
  ])

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const pushFeed = useCallback((actor: FeedEntry['actor'], label: string, detail: string, revision?: number) => {
    const rev = revision ?? stageRef.current.revision
    setFeed((current) => [
      { id: uid(), actor, label, detail, revision: rev },
      ...current,
    ].slice(0, 6))
  }, [])

  const onAgentAction = useCallback((action: AgentAction) => {
    pushFeed('AGENT', action.label, action.detail)
  }, [pushFeed])

  const movePerformer = useCallback((point: StagePoint) => {
    const current = stageRef.current
    if (current.locks.performer) {
      pushFeed('SYSTEM', 'LOCK / PERFORMER', 'Performer is locked. Unlock it to restage.', current.revision)
      return
    }
    const next: StageSnapshot = {
      ...current,
      revision: current.revision + 1,
      performer: point,
    }
    stageRef.current = next
    setStage(next)
    pushFeed('HUMAN', 'HUMAN / BLOCKING', `Performer moved to ${point.x.toFixed(1)}, ${point.z.toFixed(1)}`, next.revision)
  }, [pushFeed])

  const setCameraFromAgent = useCallback((camera: StageSnapshot['camera']) => {
    const current = stageRef.current
    const next: StageSnapshot = {
      ...current,
      revision: current.revision + 1,
      camera,
    }
    stageRef.current = next
    setStage(next)
    return next
  }, [])

  const captureTake = useCallback(async (label: string) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const canvas = document.querySelector<HTMLCanvasElement>('[data-viewfinder] canvas')
    if (!canvas) throw new Error('Viewfinder canvas is not available.')
    const snapshot = stageRef.current
    const id = uid()
    const image = canvas.toDataURL('image/jpeg', 0.88)
    const take: TakeStill = {
      id,
      label,
      image,
      revision: snapshot.revision,
      camera: { ...snapshot.camera },
      performer: { ...snapshot.performer },
    }
    setTakes((current) => [take, ...current].slice(0, 4))
    return { id, revision: snapshot.revision }
  }, [])

  useEffect(() => {
    if (!hasWebMCP()) {
      setMcpStatus('unavailable')
      return
    }
    let cleanup: (() => void) | undefined
    let cancelled = false
    registerStagePairTools({
      getSnapshot: () => stageRef.current,
      setCamera: setCameraFromAgent,
      captureTake,
      onAgentAction,
    })
      .then((dispose) => {
        if (cancelled) {
          dispose()
          return
        }
        cleanup = dispose
        setMcpStatus('live')
      })
      .catch(() => setMcpStatus('error'))

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [captureTake, onAgentAction, setCameraFromAgent])

  const toggleLock = useCallback((key: keyof StageSnapshot['locks']) => {
    const current = stageRef.current
    const locks = { ...current.locks, [key]: !current.locks[key] }
    const next: StageSnapshot = { ...current, revision: current.revision + 1, locks }
    stageRef.current = next
    setStage(next)
    pushFeed('HUMAN', 'HUMAN / LOCK', `${key} ${locks[key] ? 'locked' : 'released'}`, next.revision)
  }, [pushFeed])

  const humanCapture = useCallback(async () => {
    const result = await captureTake('Human mark')
    pushFeed('HUMAN', 'HUMAN / TAKE', `Frame marked at revision ${result.revision}`, result.revision)
  }, [captureTake, pushFeed])

  const latestFeed = useMemo(() => feed.slice(0, 4), [feed])
  const statusLabel = mcpStatus === 'live' ? 'WEBMCP / LIVE' : mcpStatus === 'checking' ? 'WEBMCP / CHECKING' : mcpStatus === 'error' ? 'WEBMCP / ERROR' : 'WEBMCP / WAITING'
  const hostNote = mcpStatus === 'live'
    ? 'AGENT SURFACE LIVE · CAMERA TOOLS REGISTERED TO THIS PAGE'
    : mcpStatus === 'error'
      ? 'HOST FOUND · TOOL REGISTRATION NEEDS ATTENTION'
      : 'HUMAN MODE ACTIVE · OPEN IN A WEBMCP HOST TO ADD THE AGENT CAMERA'

  return (
    <main className="experience-shell">
      <header className="masthead">
        <div className="wordmark" aria-label="StagePair">
          <span>STAGE</span><i>/</i><span>PAIR</span>
        </div>
        <div className="masthead-line" />
        <div className={`mcp-status ${mcpStatus}`}>
          <span className="status-dot" />
          {statusLabel}
        </div>
      </header>

      <section className="stage-layout">
        <div className="director-panel">
          <div className="panel-index">01 / LIVE STAGE</div>
          <div className="stage-canvas">
            <DirectorStage stage={stage} onMovePerformer={movePerformer} />
            <div className="stage-instruction">
              <span className="instruction-kicker">YOUR HAND</span>
              <strong>Choose a new floor mark. The performer moves; the world stays.</strong>
            </div>
            <div className="stage-axis axis-x">X</div>
            <div className="stage-axis axis-z">Z</div>
          </div>
        </div>

        <aside className="story-rail">
          <p className="eyebrow">A WEBMCP CO-DIRECTION STUDY</p>
          <h1>Two hands.<br />One frame.</h1>
          <p className="lede">
            You stage the performance.<br />Your agent finds the shot.<br />Every handoff uses the latest shared revision.
          </p>

          <div className="roles">
            <div>
              <span>HUMAN / 01</span>
              <strong>Blocking</strong>
            </div>
            <div>
              <span>AGENT / 02</span>
              <strong>Camera</strong>
            </div>
          </div>

          <div className="lock-panel">
            <span className="micro-label">CREATIVE LOCKS</span>
            <div className="lock-list">
              <LockButton locked={stage.locks.performance} onClick={() => toggleLock('performance')}>Performance</LockButton>
              <LockButton locked={stage.locks.performer} onClick={() => toggleLock('performer')}>Performer</LockButton>
              <LockButton locked={stage.locks.prop} onClick={() => toggleLock('prop')}>Prop</LockButton>
              <LockButton locked={stage.locks.camera} onClick={() => toggleLock('camera')}>Camera</LockButton>
            </div>
          </div>

          <p className={`host-note ${mcpStatus}`}>
            <span>{mcpStatus === 'live' ? 'PAIR / CONNECTED' : 'PAIR / HOST'}</span>
            {hostNote}
          </p>
        </aside>

        <div className="viewfinder-panel">
          <div className="panel-index">02 / AGENT CAMERA</div>
          <div className="viewfinder" data-viewfinder>
            <Viewfinder stage={stage} />
            <div className="frame-corners" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="crosshair" aria-hidden="true"><span /><span /></div>
            <div className="viewfinder-meta top">
              <span>CAM / B</span>
              <span>REV {String(stage.revision).padStart(2, '0')}</span>
            </div>
            <div className="viewfinder-meta bottom">
              <span>{stage.camera.fov.toFixed(0)}°</span>
              <span>X {stage.camera.x.toFixed(1)} / Z {stage.camera.z.toFixed(1)}</span>
            </div>
          </div>
          <button type="button" className="capture-button" onClick={humanCapture}>
            <span>MARK THIS FRAME</span>
            <b>↗</b>
          </button>
        </div>
      </section>

      <section className="lower-deck">
        <div className="pair-feed">
          <div className="lower-heading">
            <span>PAIR FEED</span>
            <em>shared state · rev {stage.revision}</em>
          </div>
          <div className="feed-entries">
            {latestFeed.map((entry) => (
              <article className={`feed-entry actor-${entry.actor.toLowerCase()}`} key={entry.id}>
                <span>{entry.label}</span>
                <p>{entry.detail}</p>
                <b>{String(entry.revision).padStart(2, '0')}</b>
              </article>
            ))}
          </div>
        </div>

        <div className="contact-sheet">
          <div className="lower-heading">
            <span>CONTACT SHEET</span>
            <em>{takes.length ? `${takes.length} frame${takes.length > 1 ? 's' : ''}` : 'mark a frame'}</em>
          </div>
          <div className="takes">
            {takes.length === 0 ? (
              <div className="empty-take">
                <span>NO. 00</span>
                <p>Human and agent captures land here with the exact shared revision.</p>
              </div>
            ) : takes.map((take, index) => (
              <figure key={take.id} className="take-card">
                <img src={take.image} alt={`${take.label}, revision ${take.revision}`} />
                <figcaption>
                  <span>{String(index + 1).padStart(2, '0')} · {take.label}</span>
                  <b>R{take.revision}</b>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer-line">
        <span>ONE STAGE / TWO COLLABORATORS</span>
        <span>↳ HUMAN CHANGES THE WORLD · AGENT CHANGES THE VIEW</span>
        <span>WEBMCP CHALLENGE · 2026</span>
      </footer>
    </main>
  )
}
