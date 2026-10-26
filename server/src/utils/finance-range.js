import { centerWallTimeToUtc } from './center-time.js'
import { httpError } from '../security/errors.js'
export const centerToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export function centerPeriodRange(period, input = centerToday()) {
  const value = String(input).length === 7 ? input + '-01' : String(input)
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw httpError(400,'Некорректная дата периода.')
  // Validate the actual calendar day, not only its shape.
  centerWallTimeToUtc(value,'00:00')
  const d = new Date(value+'T12:00:00Z')
  if (period === 'month') d.setUTCDate(1)
  const startDate = d.toISOString().slice(0,10)
  if (period === 'month') d.setUTCMonth(d.getUTCMonth()+1)
  else d.setUTCDate(d.getUTCDate()+1)
  return { start: centerWallTimeToUtc(startDate,'00:00'), end: centerWallTimeToUtc(d.toISOString().slice(0,10),'00:00') }
}
