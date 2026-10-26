export function discountFor(client, isPackage) {
  const military = client?.isMilitary ? (isPackage ? 20 : 10) : 0
  const pensioner = client?.isPensioner ? 15 : 0
  const percent = Math.max(military, pensioner)
  let reason = null
  if (percent === 20) reason = 'MILITARY_COURSE'
  else if (percent === 15) reason = 'PENSIONER'
  else if (percent === 10) reason = 'MILITARY_SINGLE'
  return { percent, reason }
}
export function discountedPrice(basePrice, percent) {
  return Math.round(Number(basePrice) * (100-percent)) / 100
}
