export const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
export function payConfigFor(service) {
  return {
    version: 1,
    mode: service.specialistPayMode || (service.massageTieredPay ? 'MASSAGE_TIER' : 'FIXED'),
    percent: Number(service.specialistPayPercent || 0),
    groupPayMode: service.groupPayMode || 'PER_CLIENT',
    isGroup: Boolean(service.groupAllowed),
    massageHalfHourTracking: Boolean(service.massageHalfHourTracking),
    massagePayClassMinutes: service.massagePayClassMinutes || service.durationMinutes,
    massageUseHigherOfTierAndFixed: Boolean(service.massageUseHigherOfTierAndFixed),
  }
}
export function fixedPayFor(service, pricePerVisit) {
  return service.specialistPayMode === 'PERCENT'
    ? roundMoney(Number(pricePerVisit) * Number(service.specialistPayPercent || 0) / 100)
    : Number(service.specialistPayPerSession || 0)
}
export function sessionKey(appointment) {
  return [appointment.specialistId, appointment.serviceId, new Date(appointment.startTime).toISOString(), new Date(appointment.endTime).toISOString()].join(':')
}
export function tracksMassage(appointment) {
  return appointment.payConfig?.massageHalfHourTracking ?? appointment.service?.massageHalfHourTracking
}
