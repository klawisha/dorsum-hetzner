import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { config } from '../config/env.js'
export async function authMiddleware(req, reply) {
  const match = /^Bearer ([A-Za-z0-9_.-]{20,2048})$/.exec(req.headers.authorization || '')
  if (!match) return reply.code(401).send({ message: 'Войдите в аккаунт.' })
  let decoded
  try { decoded = jwt.verify(match[1], config.secret, { algorithms: ['HS256'], issuer: 'dorsum-api', audience: 'dorsum-web' }) }
  catch { return reply.code(401).send({ message: 'Сессия истекла. Войдите снова.' }) }
  if (decoded.typ !== 'access' || typeof decoded.sub !== 'string' || typeof decoded.sid !== 'string') return reply.code(401).send({ message: 'Недействительная сессия.' })
  const session = await prisma.authSession.findUnique({
    where: { id: decoded.sid },
    select: { userId: true, expiresAt: true, revokedAt: true, user: { select: { id: true, role: true, active: true, phone: true } } },
  })
  if (!session || session.userId !== decoded.sub || session.revokedAt || session.expiresAt <= new Date() || !session.user.active) return reply.code(401).send({ message: 'Сессия завершена. Войдите снова.' })
  if (session.user.role === 'CLIENT' && session.user.phone) {
    const count = await prisma.clientProfile.count({ where: { phone: session.user.phone, active: true, OR: [{ userId: null }, { user: { active: true } }] } })
    if (count > 1) {
      await prisma.authSession.updateMany({ where: { id: decoded.sid }, data: { revokedAt: new Date() } })
      return reply.code(401).send({ message: 'Общий номер используется несколькими клиентами. Обратитесь к администратору.' })
    }
  }
  req.user = { id: session.user.id, role: session.user.role, sessionId: decoded.sid }
}
