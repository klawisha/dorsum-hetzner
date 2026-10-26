import { useMemo, useState } from "react"

const moneyCompact = (value) => new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function kyivDay(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(
    dayFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function revenueMix(summary) {
  const entries = [
    { key: "appointments", label: "Занятия", value: Number(summary?.cash?.appointments || 0) },
    { key: "courses", label: "Курсы", value: Number(summary?.cash?.courses || 0) },
    { key: "inventory", label: "Инвентарь", value: Number(summary?.cash?.inventory || 0) },
  ]
  const total = entries.reduce((sum, item) => sum + item.value, 0)
  return entries.map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
  }))
}

export default function FinanceMonthPulse({ summary, month }) {
  const series = useMemo(() => {
    if (!summary || !month) return []

    const count = daysInMonth(month)
    const values = Array.from({ length: count }, (_, index) => ({
      day: index + 1,
      value: 0,
    }))

    const payments = [
      ...(summary.payments?.appointments || []),
      ...(summary.payments?.courses || []),
      ...(summary.payments?.inventory || []),
    ]

    for (const payment of payments) {
      const dateKey = kyivDay(payment.paidAt)
      if (!dateKey?.startsWith(`${month}-`)) continue
      const day = Number(dateKey.slice(-2))
      if (day >= 1 && day <= count) values[day - 1].value += Number(payment.amount || 0)
    }

    return values
  }, [summary, month])

  const mix = useMemo(() => revenueMix(summary), [summary])
  const peak = useMemo(
    () => series.reduce((best, point) => point.value > best.value ? point : best, { day: 1, value: 0 }),
    [series],
  )

  const lastActiveDay = useMemo(() => {
    for (let index = series.length - 1; index >= 0; index -= 1) {
      if (series[index].value > 0) return series[index].day
    }
    return 1
  }, [series])

  const [selectedDay, setSelectedDay] = useState(null)
  const activeDay = Math.min(selectedDay || lastActiveDay, Math.max(1, series.length))
  const activePoint = series[activeDay - 1] || { day: 1, value: 0 }
  const maxValue = Math.max(1, ...series.map((point) => point.value))

  const chart = useMemo(() => {
    if (!series.length) return { points: "", coords: [] }
    const width = 420
    const height = 116
    const padX = 6
    const padTop = 10
    const padBottom = 12
    const usableWidth = width - padX * 2
    const usableHeight = height - padTop - padBottom

    const coords = series.map((point, index) => {
      const x = series.length === 1
        ? width / 2
        : padX + (index / (series.length - 1)) * usableWidth
      const y = padTop + usableHeight - (point.value / maxValue) * usableHeight
      return { ...point, x, y }
    })

    return {
      points: coords.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
      coords,
    }
  }, [series, maxValue])

  return (
    <section className="finance-month-pulse" aria-label="График выручки за месяц">
      <div className="finance-pulse-head">
        <div>
          <span>График месяца</span>
          <strong>{moneyCompact(activePoint.value)} грн</strong>
          <small>{activePoint.day} число · пик {moneyCompact(peak.value)} грн</small>
        </div>
        <div className="finance-pulse-live"><i /> LIVE</div>
      </div>

      <div className="finance-pulse-chart">
        <svg viewBox="0 0 420 116" preserveAspectRatio="none" role="img" aria-label="График выручки по дням">
          <line x1="6" y1="104" x2="414" y2="104" className="finance-pulse-axis" />
          <line x1="6" y1="57" x2="414" y2="57" className="finance-pulse-gridline" />
          <polyline points={chart.points} className="finance-pulse-line-shadow" />
          <polyline points={chart.points} className="finance-pulse-line" />

          {chart.coords.map((point) => (
            <g key={point.day}>
              {point.day === activeDay && (
                <line x1={point.x} y1="8" x2={point.x} y2="104" className="finance-pulse-cursor" />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={point.day === activeDay ? 4.3 : point.value > 0 ? 2.4 : 1.25}
                className={point.day === activeDay ? "finance-pulse-dot active" : "finance-pulse-dot"}
              />
              <rect
                x={Math.max(0, point.x - 8)}
                y="0"
                width="16"
                height="116"
                className="finance-pulse-hit"
                tabIndex="0"
                role="button"
                aria-label={`${point.day} число: ${moneyCompact(point.value)} грн`}
                onClick={() => setSelectedDay(point.day)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedDay(point.day)
                }}
              />
            </g>
          ))}
        </svg>
        <div className="finance-pulse-scale"><span>01</span><span>{String(Math.ceil(series.length / 2)).padStart(2, "0")}</span><span>{String(series.length).padStart(2, "0")}</span></div>
      </div>

      <div className="finance-pulse-mix">
        {mix.map((item) => (
          <div key={item.key} className="finance-pulse-mix-row">
            <div><span>{item.label}</span><b>{item.percent}%</b></div>
            <i><em style={{ width: `${item.percent}%` }} /></i>
          </div>
        ))}
      </div>
    </section>
  )
}
