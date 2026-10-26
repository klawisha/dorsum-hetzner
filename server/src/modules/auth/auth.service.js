import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto'
import prisma from '../../config/prisma.js'
import { config } from '../../config/env.js'
import { httpError } from '../../security/errors.js'
import { validatePassword } from '../../security/password.js'

const hashToken = value => createHash('sha256').update(value).digest('hex')
const dummyHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s().-]+$/.test(value)) throw httpError(400, 'Некорректный номер телефона.')
  let digits = value.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) digits = '38' + digits
  if (digits.length < 8 || digits.length > 15) throw httpError(400, 'Некорректный номер телефона.')
  return '+' + digits
}
export function publicUser(user) { return { id: user.id, phone: user.phone, email: user.email ?? null, role: user.role, createdAt: user.createdAt } }
function accessToken(user, sessionId) {
  return jwt.sign({ typ: 'access', sid: sessionId }, config.secret, {
    algorithm: 'HS256', subject: user.id, issuer: 'dorsum-api', audience: 'dorsum-web', expiresIn: '10m', jwtid: randomUUID(),
  })
}
async function enforceSharedPhone(user) {
  if (user.role !== 'CLIENT' || !user.phone) return
  const count = await prisma.clientProfile.count({ where: { phone: user.phone, active: true, OR: [{ userId: null }, { user: { active: true } }] } })
  if (count > 1) throw httpError(409, 'На этот номер зарегистрировано несколько клиентов. Обратитесь к администратору.')
}
async function throttle(identifier) {
  const key = createHmac('sha256', config.secret).update(identifier).digest('hex')
  const now = new Date(), windowStart = new Date(now.getTime() - 15 * 60_000)
  const rows = await prisma.$queryRaw`
    INSERT INTO "LoginThrottle" ("key","attempts","windowStart") VALUES (${key},1,${now})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "LoginThrottle"."windowStart" < ${windowStart} THEN 1 ELSE "LoginThrottle"."attempts" + 1 END,
      "windowStart" = CASE WHEN "LoginThrottle"."windowStart" < ${windowStart} THEN ${now} ELSE "LoginThrottle"."windowStart" END
    RETURNING "attempts"`
  if (rows[0].attempts > 10) throw httpError(429, 'Слишком много попыток входа. Повторите через 15 минут.')
  return key
}
async function createSession(user) {
  const id = randomUUID(), token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000)
  await prisma.authSession.create({ data: { id, userId: user.id, tokenHash: hashToken(token), expiresAt } })
  return { user: publicUser(user), accessToken: accessToken(user, id), cookie: id + '.' + token, expiresAt }
}
export const AuthService = {
  async register(fullName, phoneInput, password) {
    if (!config.registration) throw httpError(403, 'Регистрация доступна через администратора центра.')
    const phone = normalizePhone(phoneInput)
    validatePassword(password)
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 160) throw httpError(400, 'Введите корректное ФИО.')
    const existing = await prisma.clientProfile.count({ where: { phone, active: true } })
    if (existing) throw httpError(409, 'Номер уже используется. Обратитесь к администратору.')
    const hash = await bcrypt.hash(password, 12)
    return prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { phone, password: hash, role: 'CLIENT' } })
      await tx.clientProfile.create({ data: { userId: user.id, fullName: fullName.trim(), phone } })
      return publicUser(user)
    })
  },
  async login(identifierInput, password) {
    validatePassword(password, { existing: true })
    const raw = String(identifierInput ?? '').trim().toLowerCase()
    const identifier = raw.includes('@') ? raw : normalizePhone(raw)
    const key = await throttle(identifier)
    const user = await prisma.user.findUnique({ where: identifier.includes('@') ? { email: identifier } : { phone: identifier } })
    const valid = await bcrypt.compare(password, user?.password || dummyHash)
    if (!valid || !user?.active) throw httpError(401, 'Неверный телефон или пароль.')
    await enforceSharedPhone(user)
    await prisma.loginThrottle.deleteMany({ where: { key } })
    // A bounded session list prevents unbounded growth from repeated logins.
    await prisma.authSession.deleteMany({ where: { userId: user.id, OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] } })
    const active = await prisma.authSession.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, skip: 9, select: { id: true } })
    if (active.length) await prisma.authSession.updateMany({ where: { id: { in: active.map(s => s.id) } }, data: { revokedAt: new Date() } })
    return createSession(user)
  },
  async refresh(cookie) {
    const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(cookie || '')
    if (!match) throw httpError(401, 'Сессия истекла. Войдите снова.')
    const session = await prisma.authSession.findUnique({ where: { id: match[1] }, include: { user: true } })
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active) throw httpError(401, 'Сессия завершена. Войдите снова.')
    if (session.tokenHash !== hashToken(match[2])) {
      await prisma.authSession.updateMany({ where: { id: session.id }, data: { revokedAt: new Date() } })
      throw httpError(401, 'Сессия завершена. Войдите снова.')
    }
    await enforceSharedPhone(session.user)
    const next = randomBytes(32).toString('base64url')
    const updated = await prisma.authSession.updateMany({
      where: { id: session.id, tokenHash: session.tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { tokenHash: hashToken(next), lastUsedAt: new Date() },
    })
    if (!updated.count) throw httpError(401, 'Сессия изменилась. Войдите снова.')
    return { user: publicUser(session.user), accessToken: accessToken(session.user, session.id), cookie: session.id + '.' + next, expiresAt: session.expiresAt }
  },
  async logout(cookie) {
    const id = /^([0-9a-f-]{36})\./.exec(cookie || '')?.[1]
    if (id) await prisma.authSession.updateMany({ where: { id }, data: { revokedAt: new Date() } })
  },
}
