export const CENTER_TIME_ZONE = "Europe/Kyiv"

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CENTER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function zonedParts(date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
}

function offsetMsAt(date) {
  const parts = zonedParts(date)
  const reconstructedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )

  // Ignore source milliseconds because formatter precision is seconds.
  const sourceWithoutMs = date.getTime() - date.getMilliseconds()
  return reconstructedUtc - sourceWithoutMs
}

export function centerWallTimeToUtc(localDate, localTime) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate || "")) {
    throw new Error("INVALID_LOCAL_DATE")
  }

  if (!/^\d{2}:\d{2}$/.test(localTime || "")) {
    throw new Error("INVALID_LOCAL_TIME")
  }

  const [year, month, day] = localDate.split("-").map(Number)
  const [hour, minute] = localTime.split(":").map(Number)

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) {
    throw new Error("INVALID_LOCAL_DATE_TIME")
  }

  const wallUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  // First pass estimates the zone offset near the requested wall time.
  let candidate = new Date(wallUtcMs)
  let offset = offsetMsAt(candidate)
  candidate = new Date(wallUtcMs - offset)

  // Second pass resolves DST transitions correctly.
  const refinedOffset = offsetMsAt(candidate)
  if (refinedOffset !== offset) {
    candidate = new Date(wallUtcMs - refinedOffset)
  }

  const check = zonedParts(candidate)
  const matches =
    Number(check.year) === year &&
    Number(check.month) === month &&
    Number(check.day) === day &&
    Number(check.hour) === hour &&
    Number(check.minute) === minute

  if (!matches) {
    throw new Error("INVALID_OR_NONEXISTENT_CENTER_TIME")
  }

  return candidate
}

export function centerWallRange(localDate, localTime, durationMinutes) {
  const start = centerWallTimeToUtc(localDate, localTime)
  const duration = Number(durationMinutes)

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("INVALID_DURATION")
  }

  return {
    start,
    end: new Date(start.getTime() + duration * 60000),
  }
}
