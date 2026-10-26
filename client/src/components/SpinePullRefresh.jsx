import { useCallback, useEffect, useRef, useState } from "react"

const SEGMENTS = 19
const REST_GAP = 18
const PULL_THRESHOLD = 92

function makePoints() {
  return Array.from({ length: SEGMENTS }, (_, index) => ({
    x: 0,
    y: index * REST_GAP,
    oldX: 0,
    oldY: index * REST_GAP,
  }))
}

function vertebraPath(size = 1) {
  const w = 22 * size
  const h = 10 * size
  const wing = 7 * size
  return `M ${-w / 2} ${-h / 2}
    Q ${-w * 0.24} ${-h * 0.9} 0 ${-h * 0.62}
    Q ${w * 0.24} ${-h * 0.9} ${w / 2} ${-h / 2}
    L ${w / 2 + wing} 0
    L ${w / 2} ${h / 2}
    Q ${w * 0.22} ${h * 0.84} 0 ${h * 0.62}
    Q ${-w * 0.22} ${h * 0.84} ${-w / 2} ${h / 2}
    L ${-w / 2 - wing} 0 Z`
}

function transformsFor(points) {
  return points.map((point, index) => {
    const next = points[Math.min(points.length - 1, index + 1)]
    const prev = points[Math.max(0, index - 1)]
    const angle = Math.atan2(next.y - prev.y, next.x - prev.x) * (180 / Math.PI) - 90
    return { x: point.x, y: point.y, angle }
  })
}

export default function SpinePullRefresh({ onRefresh, refreshing = false }) {
  const hostRef = useRef(null)
  const pointsRef = useRef(makePoints())
  const pointerRef = useRef({ active: false, id: null, x: 0, y: 0 })
  const animationRef = useRef(null)
  const lastTimeRef = useRef(0)
  const [transforms, setTransforms] = useState(() => transformsFor(makePoints()))
  const [pull, setPull] = useState(0)
  const [armed, setArmed] = useState(false)
  const [settledRefresh, setSettledRefresh] = useState(false)

  const simulate = useCallback(function simulate(time) {
    const points = pointsRef.current
    const pointer = pointerRef.current
    const dt = Math.min(2, Math.max(0.45, (time - lastTimeRef.current) / 16.67))
    lastTimeRef.current = time

    // Fixed ceiling anchor. Idle movement is applied only after the chain has settled,
    // so release behaves like a damped hanging cord instead of being pulled sideways.
    const maxOffset = points.reduce((value, point, index) => Math.max(
      value,
      Math.abs(point.x),
      Math.abs(point.y - index * REST_GAP),
    ), 0)
    const idleSway = !pointer.active && !refreshing && maxOffset < 2.4
      ? Math.sin(time / 1350) * 0.7
      : 0
    points[0].x = idleSway
    points[0].y = 0
    points[0].oldX = points[0].x
    points[0].oldY = 0

    for (let i = 1; i < points.length; i += 1) {
      const p = points[i]
      // While dragging we keep a little more momentum and gravity. After release,
      // switch to a critically-damped spring towards the natural vertical chain.
      // This removes the old rubber-band kick / sideways overshoot on return.
      const damping = pointer.active ? 0.91 : 0.79
      const vx = (p.x - p.oldX) * damping
      const vy = (p.y - p.oldY) * damping
      p.oldX = p.x
      p.oldY = p.y
      p.x += vx * dt
      p.y += vy * dt

      if (pointer.active) {
        p.y += 0.11 * dt * dt
      } else {
        const restY = i * REST_GAP
        const spring = refreshing ? 0.075 : 0.052
        p.x += (idleSway - p.x) * spring * dt
        p.y += (restY - p.y) * spring * dt
      }
    }

    if (pointer.active) {
      const tail = points[points.length - 1]
      const localX = Math.max(-82, Math.min(82, pointer.x))
      const localY = Math.max(points.length * REST_GAP - 12, Math.min(points.length * REST_GAP + 126, pointer.y))
      tail.x += (localX - tail.x) * 0.72
      tail.y += (localY - tail.y) * 0.72
    }

    // Constraint relaxation; several iterations gives a rope-like response.
    for (let iteration = 0; iteration < 7; iteration += 1) {
      points[0].y = 0
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1]
        const b = points[i]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.max(0.001, Math.hypot(dx, dy))
        const error = (distance - REST_GAP) / distance
        const correctionX = dx * error
        const correctionY = dy * error

        if (i === 1) {
          b.x -= correctionX
          b.y -= correctionY
        } else {
          a.x += correctionX * 0.48
          a.y += correctionY * 0.48
          b.x -= correctionX * 0.52
          b.y -= correctionY * 0.52
        }
      }
    }

    // Kill imperceptible residual velocity once the chain is home. This prevents
    // perpetual micro-jitter without making the visible return snap.
    if (!pointer.active && maxOffset < 0.65) {
      points.forEach((point, index) => {
        const targetX = idleSway
        const targetY = index * REST_GAP
        point.x = targetX
        point.y = targetY
        point.oldX = targetX
        point.oldY = targetY
      })
    }

    setTransforms(transformsFor(points))
    animationRef.current = requestAnimationFrame(simulate)
  }, [refreshing])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(simulate)
    return () => cancelAnimationFrame(animationRef.current)
  }, [simulate])

  useEffect(() => {
    if (!refreshing && settledRefresh) {
      const timer = setTimeout(() => setSettledRefresh(false), 650)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [refreshing, settledRefresh])

  const updatePullState = useCallback((clientX, clientY) => {
    const rect = hostRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clientX - (rect.left + rect.width / 2)
    const y = clientY - rect.top - 18
    pointerRef.current.x = x
    pointerRef.current.y = y
    const restTailY = (SEGMENTS - 1) * REST_GAP
    const distance = Math.max(0, y - restTailY)
    setPull(distance)
    setArmed(distance >= PULL_THRESHOLD)
  }, [])

  const release = useCallback(async (event) => {
    const pointer = pointerRef.current
    if (!pointer.active) return
    pointer.active = false
    if (event?.currentTarget?.releasePointerCapture && pointer.id != null) {
      try { event.currentTarget.releasePointerCapture(pointer.id) } catch { /* capture may already be gone */ }
    }
    pointer.id = null

    const shouldRefresh = armed && !refreshing
    setPull(0)
    setArmed(false)

    if (shouldRefresh) {
      setSettledRefresh(true)
      await onRefresh?.()
    }
  }, [armed, onRefresh, refreshing])

  const progress = Math.min(1, pull / PULL_THRESHOLD)
  const stateText = refreshing
    ? "ОБНОВЛЯЕМ"
    : settledRefresh
      ? "ГОТОВО"
      : armed
        ? "ОТПУСТИТЕ — ОБНОВИТЬ"
        : pull > 12
          ? "ПОТЯНИТЕ ЕЩЁ"
          : "ПОТЯНИТЕ ДЛЯ ОБНОВЛЕНИЯ"

  return (
    <div className={`finance-spine-refresh ${armed ? "is-armed" : ""} ${refreshing ? "is-refreshing" : ""}`}>
      <div className="finance-spine-meta" aria-hidden="true">
        <span>DORSUM / LIVE DATA</span>
        <strong>{Math.round(progress * 100).toString().padStart(2, "0")}</strong>
      </div>

      <button
        ref={hostRef}
        type="button"
        className="finance-spine-stage"
        aria-label="Потяните позвоночник вниз, чтобы обновить финансовые данные"
        title="Потяните вниз для обновления"
        onPointerDown={(event) => {
          if (refreshing) return
          pointerRef.current.active = true
          pointerRef.current.id = event.pointerId
          event.currentTarget.setPointerCapture?.(event.pointerId)
          updatePullState(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!pointerRef.current.active) return
          updatePullState(event.clientX, event.clientY)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={async (event) => {
          if ((event.key === "Enter" || event.key === " ") && !refreshing) {
            event.preventDefault()
            setSettledRefresh(true)
            await onRefresh?.()
          }
        }}
      >
        <svg className="finance-spine-svg" viewBox="-105 -12 210 390" role="img" aria-hidden="true">
          <defs>
            <filter id="spineGlow" x="-80%" y="-40%" width="260%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.96  0 1 0 0 0.75  0 0 1 0 0.2  0 0 0 .5 0" />
            </filter>
            <linearGradient id="boneGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f2efe3" />
              <stop offset="0.54" stopColor="#bbb9ac" />
              <stop offset="1" stopColor="#6f746d" />
            </linearGradient>
          </defs>

          <path
            d={`M 0 0 ${transforms.slice(1).map(({ x, y }) => `L ${x} ${y}`).join(" ")}`}
            fill="none"
            stroke={armed ? "rgba(246,196,83,.34)" : "rgba(255,255,255,.09)"}
            strokeWidth="1.2"
            strokeDasharray="3 5"
          />

          {transforms.map(({ x, y, angle }, index) => {
            const ratio = index / (SEGMENTS - 1)
            const scale = 0.62 + Math.sin(ratio * Math.PI) * 0.34
            const tail = index >= SEGMENTS - 3
            return (
              <g key={index} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
                {armed && index > SEGMENTS - 7 && (
                  <path d={vertebraPath(1.1)} fill="rgba(246,196,83,.14)" filter="url(#spineGlow)" />
                )}
                <path
                  d={vertebraPath(1)}
                  fill={tail ? "#d6ad2e" : "url(#boneGradient)"}
                  stroke={tail ? "#f6c453" : "rgba(255,255,255,.32)"}
                  strokeWidth="0.75"
                />
                <circle cx="0" cy="0" r="1.8" fill="#111512" />
              </g>
            )
          })}

          <circle
            cx={transforms.at(-1)?.x || 0}
            cy={(transforms.at(-1)?.y || 0) + 2}
            r={armed ? 10 : 7}
            fill="none"
            stroke={armed ? "#f6c453" : "rgba(246,196,83,.34)"}
            strokeWidth="1"
          />
        </svg>
      </button>

      <div className="finance-spine-status" aria-live="polite">
        <span>{stateText}</span>
        <i><b style={{ transform: `scaleX(${progress})` }} /></i>
      </div>
    </div>
  )
}
