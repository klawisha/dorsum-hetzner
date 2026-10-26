import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'
export async function blockRoutes(app) {
  const guard = [authMiddleware, roleMiddleware(['SPECIALIST'])]
  async function specialist(req) { return prisma.specialistProfile.findUnique({ where: { userId: req.user.id } }) }
  app.get('/specialists/me/blocks', { preHandler: guard }, async (req, reply) => {
    const sp = await specialist(req)
    if (!sp) return reply.code(403).send({ message: 'Профиль специалиста не найден.' })
    return prisma.specialistBlock.findMany({ where: { specialistId: sp.id }, orderBy: { startTime: 'asc' } })
  })
  app.post('/specialists/me/blocks', { preHandler: guard }, async (req, reply) => {
    const sp = await specialist(req)
    if (!sp) return reply.code(403).send({ message: 'Профиль специалиста не найден.' })
    const startTime = new Date(req.body.startTime), endTime = new Date(req.body.endTime)
    if (!(startTime < endTime) || endTime - startTime > 31 * 86400_000) return reply.code(400).send({ message: 'Укажите период отсутствия до 31 дня.' })
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
      const conflict = await tx.appointment.findFirst({ where: { specialistId: sp.id, status: { not: 'CANCELLED' }, startTime: { lt: endTime }, endTime: { gt: startTime } }, select: { id: true } })
      if (conflict) return reply.code(409).send({ message: 'APPOINTMENT_CONFLICT' })
      return tx.specialistBlock.create({ data: { specialistId: sp.id, startTime, endTime, reason: req.body.reason || null } })
    })
  })
  app.delete('/specialists/me/blocks/:id', { preHandler: guard }, async (req, reply) => {
    const sp = await specialist(req)
    if (!sp) return reply.code(403).send({ message: 'Профиль специалиста не найден.' })
    await prisma.specialistBlock.deleteMany({ where: { id: req.params.id, specialistId: sp.id } })
    return { ok: true }
  })
}
