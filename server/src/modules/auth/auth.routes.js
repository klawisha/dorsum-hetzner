import bcrypt from 'bcrypt'
import prisma from '../../config/prisma.js'
import { AuthService } from './auth.service.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { config } from '../../config/env.js'
import { httpError } from '../../security/errors.js'
import { validatePassword } from '../../security/password.js'

const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' }
function csrf(req) {
  if (req.headers['x-dorsum-csrf'] !== '1' || (req.headers.origin && !config.origins.includes(req.headers.origin))) throw httpError(403, 'Обновите страницу и повторите действие.')
}
function sendSession(reply, result) {
  const { cookie, expiresAt, ...body } = result
  reply.setCookie(config.cookieName, cookie, { ...cookieOptions, expires: expiresAt })
  return reply.send(body)
}
export async function authRoutes(app) {
  app.post('/auth/register', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    csrf(req)
    return reply.code(201).send(await AuthService.register(req.body.fullName, req.body.phone, req.body.password))
  })
  app.post('/auth/login', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    csrf(req)
    const { phone, identifier, email, password } = req.body
    return sendSession(reply, await AuthService.login(phone || identifier || email, password))
  })
  app.post('/auth/refresh', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    csrf(req)
    try { return sendSession(reply, await AuthService.refresh(req.cookies[config.cookieName])) }
    catch (error) {
      if (error.statusCode === 401 || error.statusCode === 409) reply.clearCookie(config.cookieName, cookieOptions)
      throw error
    }
  })
  app.post('/auth/logout', async (req, reply) => {
    csrf(req)
    await AuthService.logout(req.cookies[config.cookieName])
    reply.clearCookie(config.cookieName, cookieOptions)
    return reply.code(204).send()
  })
  app.get('/auth/me', { preHandler: [authMiddleware] }, async req => ({ id: req.user.id, role: req.user.role }))
  app.post('/auth/change-password', { preHandler: [authMiddleware], config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body
    validatePassword(currentPassword, { existing: true }); validatePassword(newPassword)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!await bcrypt.compare(currentPassword, user.password)) throw httpError(400, 'Текущий пароль указан неверно.')
    await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 12) } })
    reply.clearCookie(config.cookieName, cookieOptions)
    return { message: 'Пароль изменён. Войдите снова.' }
  })
}
