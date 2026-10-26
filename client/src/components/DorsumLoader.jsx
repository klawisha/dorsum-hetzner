import { useEffect, useMemo, useState } from "react"

const COUNT = 18

function vertebraPath() {
  return "M -13 -5 Q -6 -9 0 -6 Q 6 -9 13 -5 L 20 0 L 13 5 Q 6 9 0 6 Q -6 9 -13 5 L -20 0 Z"
}

export default function DorsumLoader({ active = true, label = "Загрузка системы", fullscreen = true }) {
  const [visible, setVisible] = useState(active)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setLeaving(false)
      return undefined
    }

    setLeaving(true)
    const timer = setTimeout(() => setVisible(false), 360)
    return () => clearTimeout(timer)
  }, [active])

  const vertebrae = useMemo(() => Array.from({ length: COUNT }, (_, index) => {
    const t = index / (COUNT - 1)
    const y = -132 + index * 15.5
    const wave = Math.sin(t * Math.PI * 2.3) * (1 - t * 0.45)
    const scale = 0.6 + Math.sin(t * Math.PI) * 0.33
    return { index, y, wave, scale }
  }), [])

  if (!visible) return null

  return (
    <div
      className={`dorsum-loader ${fullscreen ? "is-fullscreen" : "is-inline"} ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="dorsum-loader-grid" aria-hidden="true" />
      <div className="dorsum-loader-core">
        <div className="dorsum-loader-kicker"><span>DORSUM</span><b>MOVE / RESTORE</b></div>
        <div className="dorsum-loader-spine-wrap" aria-hidden="true">
          <svg className="dorsum-loader-spine" viewBox="-90 -165 180 330">
            <defs>
              <linearGradient id="loaderBone" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f4f1e7" />
                <stop offset=".58" stopColor="#aaa99f" />
                <stop offset="1" stopColor="#5b605a" />
              </linearGradient>
              <filter id="loaderGlow" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <ellipse cx="0" cy="0" rx="39" ry="126" fill="rgba(246,196,83,.08)" filter="url(#loaderGlow)" />
            <g className="dorsum-loader-spine-chain">
              {vertebrae.map(({ index, y, wave, scale }) => (
                <g key={index} transform={`translate(0 ${y}) scale(${scale})`}>
                  <g
                    className="dorsum-loader-vertebra"
                    style={{ "--i": index, "--wave": `${wave * 24}px`, "--rot": `${wave * 10}deg` }}
                  >
                    <path d={vertebraPath()} fill={index > COUNT - 4 ? "#d7ac2c" : "url(#loaderBone)"} stroke="rgba(255,255,255,.28)" strokeWidth=".8" />
                    <circle r="2" fill="#0c100d" />
                  </g>
                </g>
              ))}
            </g>
          </svg>
        </div>
        <div className="dorsum-loader-copy">
          <strong>{label}</strong>
          <span>Система движения готовится к работе</span>
        </div>
        <div className="dorsum-loader-line"><i /></div>
      </div>
    </div>
  )
}
