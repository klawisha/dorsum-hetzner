export const CENTER_TIME_ZONE = "Europe/Kyiv"

const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CENTER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function parts(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return Object.fromEntries(
    calendarFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
}

/**
 * FullCalendar receives a timezone-less wall-clock string so browser/device
 * timezone cannot move an appointment to another visible hour.
 */
export function toCenterCalendarTime(value) {
  const valueParts = parts(value)
  if (!valueParts) return value

  return `${valueParts.year}-${valueParts.month}-${valueParts.day}T${valueParts.hour}:${valueParts.minute}:00`
}

export function centerWallParts(value) {
  const valueParts = parts(value)
  if (!valueParts) return { date: "", time: "" }

  return {
    date: `${valueParts.year}-${valueParts.month}-${valueParts.day}`,
    time: `${valueParts.hour}:${valueParts.minute}`,
  }
}

export function formatCenterDateTime(value, locale = "ru-RU", options = {}) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: CENTER_TIME_ZONE,
    ...options,
  }).format(new Date(value))
}
