import { z } from 'zod'
import { httpError } from './errors.js'
const id = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
const text = max => z.string().max(max)
const date = z.string().max(40).refine(v => Number.isFinite(Date.parse(v)))
const localDate = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const duration = z.coerce.number().int().min(5).max(480)
const money = z.coerce.number().finite().min(0).max(100_000_000).refine(v => Math.abs(v*100-Math.round(v*100))<0.000001)
const bool = z.boolean(), phone = text(40).min(8), password = text(200).min(1)
function safeKeys(value, depth = 0) {
  if (depth > 20) return false
  if (!value || typeof value !== 'object') return true
  return Object.keys(value).every(key => !['__proto__','constructor','prototype'].includes(key) && safeKeys(value[key], depth + 1))
}
const obj = shape => z.unknown().refine(value => safeKeys(value)).pipe(z.strictObject(shape)), optionalId = id.nullable().optional()
const slot = { localDate: localDate.optional(), localTime: localTime.optional(), startTime: date.optional(), duration: duration.optional() }
const image = obj({ dataBase64: text(7_000_128), mimeType: z.enum(['image/jpeg','image/png','image/webp']), fileName: text(200).optional() })
export const bodySchemas = new Map([
  ['POST /auth/register', obj({ fullName: text(160).min(2), phone, password })],
  ['POST /auth/login', obj({ phone: phone.optional(), identifier: text(160).optional(), email: text(160).optional(), password }).refine(v => v.phone || v.identifier || v.email)],
  ['POST /auth/refresh', obj({})], ['POST /auth/logout', obj({})],
  ['POST /auth/change-password', obj({ currentPassword: password, newPassword: password })],
  ['POST /clients/profile', obj({ fullName: text(160).min(2), phone: phone.optional(), birthDate: date.nullable().optional() })],
  ['POST /users/admin-create-client', obj({ fullName: text(160).min(2), phone, password: text(200).optional(), isMilitary: bool.optional(), isPensioner: bool.optional(), allowSharedPhone: bool.optional() })],
  ['POST /users/admin-create-specialist', obj({ fullName: text(160).min(2), phone, password, specializations: z.array(text(60)).max(4).optional(), color: text(7).optional() })],
  ['PATCH /users/:id/identity', obj({ fullName: text(160).min(2), phone })],
  ['PATCH /clients/:id/admin-identity', obj({ fullName: text(160).min(2), phone })],
  ['PATCH /users/:id/role', obj({ role: z.enum(['ADMIN','CLIENT','SPECIALIST']) })],
  ['PATCH /users/:id/specializations', obj({ specializations: z.array(text(60)).max(4) })],
  ['PATCH /users/:id/specialist-color', obj({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })],
  ['PATCH /users/:id/archive', obj({ reason: text(500).optional() })],
  ['PATCH /clients/:id/archive', obj({ reason: text(500).optional() })],
  ['PATCH /clients/:id/notes', obj({ notes: text(5000).nullable() })],
  ['PATCH /clients/:id/discount-status', obj({ isMilitary: bool, isPensioner: bool })],
  ['PUT /clients/:id/card-image', image], ['PUT /expenses/:id/receipt', image],
  ['POST /appointments', obj({ clientId: id, specialistId: id, serviceId: optionalId, courseId: optionalId, roomId: optionalId, ...slot }).refine(v => (v.localDate && v.localTime) || v.startTime)],
  ['PATCH /appointments/:id/edit-schedule', obj({ specialistId: id.optional(), serviceId: optionalId, courseId: optionalId, ...slot })],
  ['PATCH /appointments/:id/move', obj({ localDate, localTime })],
  ['PATCH /appointments/:id/specialist', obj({ specialistId: id })],
  ['PATCH /appointments/:id/statuses', obj({ status: z.enum(['SCHEDULED','COMPLETED','NOT_COMPLETED','CANCELLED']).optional(), paymentStatus: z.enum(['PENDING','PAID']).optional() }).refine(v => Object.keys(v).length)],
  ['POST /specialists/me/blocks', obj({ startTime: date, endTime: date, reason: text(500).nullable().optional() })],
  ['POST /courses', obj({ clientId: id, serviceId: optionalId, title: text(200).optional(), totalLessons: z.coerce.number().int().min(1).max(1000).optional(), price: money.optional(), startsAt: date.nullable().optional(), expiresAt: date.nullable().optional(), legacyImported: bool.optional(), usedLessons: z.coerce.number().int().min(0).max(1000).optional(), paymentMode: z.enum(['FULL','HALF']).optional() })],
  ['PATCH /courses/:id/payment', obj({ isPaid: bool })], ['PATCH /courses/:id/complete-payment', obj({})],
  ['POST /expenses', obj({ title: text(180).min(1), amount: money.refine(v=>v>0), note: text(1500).optional(), purchasedAt: date.optional() })],
  ['POST /expenses/:id/void', obj({ reason: text(500).optional() })],
  ['PATCH /inventory/items/:id', obj({ price: money.optional(), active: bool.optional() })],
  ['POST /inventory/sales', obj({ itemId: id, clientId: optionalId, quantity: z.coerce.number().int().min(1).max(1000).optional(), unitPrice: money.optional(), note: text(1000).optional() })],
  ['POST /inventory/sales/:id/void', obj({ reason: text(500).optional() })],
  ['PATCH /services/:id', obj({
    price: money.optional(), specialistPayPerSession: money.optional(), durationMinutes: duration.optional(),
    packageSessions: z.coerce.number().int().min(1).max(1000).nullable().optional(), active: bool.optional(),
    groupAllowed: bool.optional(), maxClients: z.coerce.number().int().min(1).max(100).optional(),
    massageHalfHourTracking: bool.optional(), massageTieredPay: bool.optional(), massageUseHigherOfTierAndFixed: bool.optional(),
    massagePayClassMinutes: z.coerce.number().int().min(1).max(480).nullable().optional(),
  })],
])
const serviceShape = {
 title: text(200).min(2), price: money, durationMinutes: duration, category: text(60).regex(/^[A-Z0-9_]+$/),
 audience: z.enum(['ALL','ADULT','CHILD']).default('ALL'),
 isPackage: bool.default(false), packageSessions: z.coerce.number().int().min(1).max(1000).nullable().default(null),
 specialistPayMode: z.enum(['FIXED','PERCENT','MASSAGE_TIER']).default('FIXED'),
 specialistPayPerSession: money.default(0), specialistPayPercent: z.coerce.number().min(0).max(100).default(0),
 groupAllowed: bool.default(false), maxClients: z.coerce.number().int().min(1).max(100).default(1),
 groupPayMode: z.enum(['PER_CLIENT','PER_SESSION']).default('PER_CLIENT'), active: bool.default(true),
 massageHalfHourTracking: bool.default(false), massageTieredPay: bool.optional(),
 massagePayClassMinutes: z.coerce.number().int().min(1).max(480).nullable().default(null), massageUseHigherOfTierAndFixed: bool.default(false),
}
bodySchemas.set('POST /services',obj(serviceShape))
bodySchemas.set('PATCH /services/:id',obj(Object.fromEntries(Object.entries(serviceShape).map(([key,schema])=>[key,(schema instanceof z.ZodDefault ? schema.removeDefault() : schema).optional()]))))
bodySchemas.set('POST /payroll/massage-policies',obj({month:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),name:text(120).min(2),enabled:bool,tiers:z.array(obj({minHalfHours:z.number().int().min(0).max(100000),maxHalfHours:z.number().int().min(0).max(100000).nullable(),pay30:money,pay60:money,pay90:money})).min(1).max(20)}))

export async function validateRequest(req) {
  for (const value of Object.values(req.params || {})) if (!id.safeParse(value).success) throw httpError(400, 'Некорректный идентификатор.')
  for (const [key, value] of Object.entries(req.query || {})) {
    if (typeof value !== 'string' || value.length > 200) throw httpError(400, 'Некорректные параметры запроса.')
    if (key === 'month' && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) throw httpError(400, 'Некорректный месяц.')
  }
  const schema = bodySchemas.get(req.method + ' ' + req.routeOptions.url)
  if (schema) {
    const result = schema.safeParse(req.body ?? {})
    if (!result.success) throw httpError(400, 'Проверьте заполненные поля.', 'VALIDATION_ERROR')
    req.body = result.data
  }
}
