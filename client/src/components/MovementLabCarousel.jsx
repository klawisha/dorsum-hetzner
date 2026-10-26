import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import SpineInteraction from "./SpineInteraction"

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function JointLab() {
  const rootRef = useRef(null)
  const activeRef = useRef(false)
  const [angle, setAngle] = useState(0)

  function updateFromPointer(event) {
    if (!activeRef.current || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width * 0.5
    const cy = rect.top + rect.height * 0.58
    const dx = event.clientX - cx
    const dy = event.clientY - cy
    const deg = Math.atan2(dx, -dy) * (180 / Math.PI)
    setAngle(clamp(deg, -62, 62))
  }

  function release(event) {
    activeRef.current = false
    setAngle(0)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const load = Math.round(Math.abs(angle) / 62 * 100)
  const state =
    load < 20
      ? { code: "00", title: "НЕЙТРАЛЬ", note: "Сустав находится в условной нейтральной позиции." }
      : load < 68
        ? { code: "01", title: "КОНТРОЛЬ", note: "Движение остаётся в управляемом диапазоне." }
        : { code: "02", title: "КРАЙ ДИАПАЗОНА", note: "Близко к условной границе амплитуды — отпустите сегмент." }

  return (
    <aside className="joint-lab">
      <div className="motion-lab-top">
        <span>DORSUM / JOINT LAB</span>
        <strong>{state.code}</strong>
      </div>

      <div
        className="joint-stage"
        ref={rootRef}
        role="slider"
        aria-label="Интерактивная модель сустава"
        aria-valuemin={-62}
        aria-valuemax={62}
        aria-valuenow={Math.round(angle)}
        tabIndex={0}
        onPointerDown={(event) => {
          activeRef.current = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
          updateFromPointer(event)
        }}
        onPointerMove={updateFromPointer}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setAngle((value) => clamp(value - 6, -62, 62))
          if (event.key === "ArrowRight") setAngle((value) => clamp(value + 6, -62, 62))
          if (event.key === "Escape" || event.key === "Enter") setAngle(0)
        }}
      >
        <div className="joint-grid" aria-hidden="true" />

        <div className="joint-socket" aria-hidden="true">
          <span className="joint-capsule" />
          <span className="joint-head" />
        </div>

        <div
          className="joint-bone moving"
          aria-hidden="true"
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
        >
          <i className="bone-shaft" />
          <i className="bone-condyle" />
        </div>

        <div className="joint-bone fixed" aria-hidden="true">
          <i className="bone-shaft" />
          <i className="bone-condyle" />
        </div>

        <svg className="joint-arc" viewBox="0 0 320 320" aria-hidden="true">
          <path d="M 88 205 A 112 112 0 0 1 232 205" />
          <circle
            cx={160 + Math.sin((angle * Math.PI) / 180) * 112}
            cy={205 - Math.cos((angle * Math.PI) / 180) * 112}
            r="4.5"
          />
        </svg>

        <div className="joint-tension" aria-hidden="true">
          <span style={{ transform: `scaleX(${0.35 + load / 100 * 0.65})` }} />
        </div>

        <span className="joint-angle">{Math.round(angle)}°</span>
        <span className="spine-drag-hint">DRAG / ДВИГАЙ</span>
      </div>

      <div className="motion-lab-copy">
        <div>
          <small>СОСТОЯНИЕ</small>
          <strong>{state.title}</strong>
        </div>
        <p>{state.note}</p>
      </div>

      <div className="joint-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(4, load)}%` }} />
      </div>

      <p className="spine-disclaimer">
        Интерактив — визуальная метафора суставного движения, не анатомическая модель.
      </p>
    </aside>
  )
}

function MuscleLab() {
  const rootRef = useRef(null)
  const activeRef = useRef(false)
  const [strain, setStrain] = useState(0)

  function updateFromPointer(event) {
    if (!activeRef.current || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const t = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    setStrain((t - 0.5) * 2)
  }

  function release(event) {
    activeRef.current = false
    setStrain(0)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const absolute = Math.abs(strain)
  const contraction = strain < 0

  const state =
    absolute < 0.16
      ? { code: "00", title: "НЕЙТРАЛЬ", note: "Мышечно-сухожильная цепь в условном исходном состоянии." }
      : contraction
        ? { code: "01", title: "СОКРАЩЕНИЕ", note: "Волокна условно укорачиваются и утолщаются." }
        : { code: "02", title: "РАСТЯЖЕНИЕ", note: "Цепь удлиняется, а натяжение условно возрастает." }

  const muscleScaleX = contraction ? 1 - absolute * 0.28 : 1 + absolute * 0.34
  const muscleScaleY = contraction ? 1 + absolute * 0.5 : 1 - absolute * 0.2
  const tendonStretch = 1 + (contraction ? -absolute * 0.12 : absolute * 0.28)

  return (
    <aside className="muscle-lab">
      <div className="motion-lab-top">
        <span>DORSUM / MUSCLE LAB</span>
        <strong>{state.code}</strong>
      </div>

      <div
        className="muscle-stage"
        ref={rootRef}
        role="slider"
        aria-label="Интерактивная модель мышечно-сухожильной цепи"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(strain * 100)}
        tabIndex={0}
        onPointerDown={(event) => {
          activeRef.current = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
          updateFromPointer(event)
        }}
        onPointerMove={updateFromPointer}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setStrain((value) => clamp(value - 0.1, -1, 1))
          if (event.key === "ArrowRight") setStrain((value) => clamp(value + 0.1, -1, 1))
          if (event.key === "Escape" || event.key === "Enter") setStrain(0)
        }}
      >
        <div className="muscle-grid" aria-hidden="true" />

        <div className="muscle-bone left" aria-hidden="true">
          <span className="muscle-bone-head" />
          <span className="muscle-bone-shaft" />
        </div>

        <div className="muscle-bone right" aria-hidden="true">
          <span className="muscle-bone-head" />
          <span className="muscle-bone-shaft" />
        </div>

        <div
          className="tendon left"
          style={{ transform: `scaleX(${tendonStretch})` }}
          aria-hidden="true"
        />
        <div
          className="tendon right"
          style={{ transform: `scaleX(${tendonStretch})` }}
          aria-hidden="true"
        />

        <div
          className="muscle-belly"
          style={{
            transform: `translate(-50%, -50%) scaleX(${muscleScaleX}) scaleY(${muscleScaleY})`,
          }}
          aria-hidden="true"
        >
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} style={{ "--fiber-index": index }} />
          ))}
        </div>

        <div
          className="muscle-pulse"
          style={{ opacity: 0.18 + absolute * 0.55 }}
          aria-hidden="true"
        />

        <span className="muscle-label left">ORIGIN</span>
        <span className="muscle-label right">INSERTION</span>
        <span className="spine-drag-hint">DRAG / СЖАТЬ — РАСТЯНУТЬ</span>
      </div>

      <div className="motion-lab-copy">
        <div>
          <small>СОСТОЯНИЕ</small>
          <strong>{state.title}</strong>
        </div>
        <p>{state.note}</p>
      </div>

      <div className="muscle-meter" aria-hidden="true">
        <span
          style={{
            width: `${Math.max(4, absolute * 100)}%`,
            marginLeft: strain < 0 ? `${100 - Math.max(4, absolute * 100)}%` : "0",
          }}
        />
      </div>

      <p className="spine-disclaimer">
        Интерактив — визуальная метафора работы мышечной цепи, не медицинская модель.
      </p>
    </aside>
  )
}

export default function MovementLabCarousel() {
  const [index, setIndex] = useState(0)

  const labs = [
    <SpineInteraction key="spine" />,
    <JointLab key="joint" />,
    <MuscleLab key="muscle" />,
  ]

  const names = ["SPINE", "JOINT", "MUSCLE"]

  const go = (direction) => {
    setIndex((value) => (value + direction + labs.length) % labs.length)
  }

  return (
    <div className="movement-carousel">
      <div className="movement-carousel-frame">{labs[index]}</div>

      <div className="movement-carousel-nav">
        <button onClick={() => go(-1)} aria-label="Предыдущий интерактив">
          <ChevronLeft size={18} />
        </button>

        <div>
          {names.map((name, itemIndex) => (
            <button
              key={name}
              className={itemIndex === index ? "active" : ""}
              onClick={() => setIndex(itemIndex)}
            >
              <span>{String(itemIndex + 1).padStart(2, "0")}</span>
              {name}
            </button>
          ))}
        </div>

        <button onClick={() => go(1)} aria-label="Следующий интерактив">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
