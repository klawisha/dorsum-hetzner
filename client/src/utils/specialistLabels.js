export const SPECIALIZATION_LABELS = {
  REHABILITATION_SPECIALIST: "Реабилитолог",
  MASSAGE_THERAPIST: "Массажист",
  TRAINER: "Тренер",
  DOCTOR: "Врач",
}

export function formatSpecialization(value) {
  if (!value) return ""
  return SPECIALIZATION_LABELS[value] || value
}

export function formatSpecializations(values = []) {
  const labels = [...new Set(values.filter(Boolean).map(formatSpecialization))]
  return labels.length ? labels.join(" / ") : "Специалист Dorsum"
}
