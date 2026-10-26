import { roundMoney } from './pay-snapshot.js'
export function halfHourUnits(appointment) {
  const duration = Number(appointment.duration || appointment.service?.durationMinutes || 0)
  return Number.isFinite(duration) && duration > 0 ? Math.ceil(duration / 30) : 0
}
export function selectMassageTier(policy, totalHalfHours) {
  if (!policy?.enabled || !Array.isArray(policy.tiers)) return null
  return [...policy.tiers].sort((a,b)=>a.minHalfHours-b.minHalfHours).find(t=>totalHalfHours>=t.minHalfHours && totalHalfHours<=(t.maxHalfHours??Infinity))||null
}
export function massageTierPay(appointment,tier) {
  const cfg=appointment.payConfig
  if ((cfg ? cfg.mode !== 'MASSAGE_TIER' : !appointment.service?.massageTieredPay) || !tier) return null
  const minutes=Number(cfg?.massagePayClassMinutes || appointment.service?.massagePayClassMinutes || appointment.service?.durationMinutes || appointment.duration)
  return minutes===30?Number(tier.pay30):minutes===60?Number(tier.pay60):minutes===90?Number(tier.pay90):null
}
export function specialistAppointmentPay(appointment,tier) {
  const dynamic=massageTierPay(appointment,tier)
  const snapshot=Number(appointment.specialistPay)
  const fixed=Number.isFinite(snapshot)?snapshot:Number(appointment.service?.specialistPayPerSession||0)
  const floor=appointment.payConfig?.massageUseHigherOfTierAndFixed ?? appointment.service?.massageUseHigherOfTierAndFixed
  return roundMoney(dynamic!=null&&Number.isFinite(dynamic)?(floor?Math.max(dynamic,fixed):dynamic):fixed)
}
export function tierLabel(tier) { return !tier?null:tier.maxHalfHours==null?String(tier.minHalfHours)+'+':tier.minHalfHours+'–'+tier.maxHalfHours }
