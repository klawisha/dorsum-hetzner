import { useMemo, useRef, useState } from "react"

const VERTEBRAE = 15

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function SpineInteraction() {
  const rootRef = useRef(null)
  const dragRef = useRef({ active: false, startX: 0 })
  const [bend, setBend] = useState(0)
  const [dragging, setDragging] = useState(false)

  const state = useMemo(() => {
    const absolute = Math.abs(bend)
    if (absolute < 0.12) return { code: "00", title: "НЕЙТРАЛЬ", note: "Зажмите позвоночник и мягко потяните в сторону." }
    if (absolute < 0.55) return { code: "01", title: "КОНТРОЛЬ АМПЛИТУДЫ", note: "Движение остаётся управляемым — без резких скачков." }
    return { code: "02", title: "ВОЗВРАТ К НЕЙТРАЛИ", note: "Отпустите — система сама вернётся в исходное положение." }
  }, [bend])

  function onPointerDown(event) {
    if (!rootRef.current) return
    dragRef.current = { active: true, startX: event.clientX }
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    if (!dragRef.current.active || !rootRef.current) return
    const width = rootRef.current.getBoundingClientRect().width || 320
    const dx = event.clientX - dragRef.current.startX
    setBend(clamp(dx / (width * 0.32), -1, 1))
  }

  function release(event) {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    setDragging(false)
    setBend(0)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <aside className={`spine-lab ${dragging ? "dragging" : ""}`} ref={rootRef}>
      <div className="spine-lab-topline">
        <span>DORSUM / SPINE LAB</span>
        <strong>{state.code}</strong>
      </div>
      <div
        className="spine-stage"
        role="slider"
        aria-label="Интерактивная модель движения позвоночника"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(bend * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setBend((v) => clamp(v - 0.12, -1, 1))
          if (event.key === "ArrowRight") setBend((v) => clamp(v + 0.12, -1, 1))
          if (event.key === "Escape" || event.key === "Enter") setBend(0)
        }}
      >
        <div className="spine-axis" />
        <div className="spine-stack" aria-hidden="true">
          {Array.from({ length: VERTEBRAE }, (_, index) => {
            const t = index / (VERTEBRAE - 1)
            const curve = Math.sin(t * Math.PI)
            const directionBias = 0.72 + t * 0.28
            const x = bend * curve * 76 * directionBias
            const rotation = bend * (t - 0.5) * 18
            const scale = 0.78 + Math.sin(t * Math.PI) * 0.22
            return (
              <span
                key={index}
                className="vertebra"
                style={{
                  "--x": `${x}px`,
                  "--r": `${rotation}deg`,
                  "--s": scale,
                  "--delay": `${Math.abs(index - 7) * 8}ms`,
                }}
              >
                <i />
              </span>
            )
          })}
        </div>
        <span className="spine-drag-hint">DRAG / ТЯНИ</span>
      </div>
      <div className="spine-lab-copy">
        <div>
          <small>СОСТОЯНИЕ</small>
          <strong>{state.title}</strong>
        </div>
        <p>{state.note}</p>
      </div>
      <div className="spine-meter" aria-hidden="true">
        <span style={{ transform: `translateX(${bend * 100}%)` }} />
      </div>
      <p className="spine-disclaimer">Интерактив — визуальная метафора контроля движения, не медицинская модель.</p>
    </aside>
  )
}
