import prisma from '../config/prisma.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { roleMiddleware } from '../middleware/role.middleware.js'

export async function securityRoutes(app) {
  app.get('/security/audit', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async () =>
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }))
}
export async function recordAudit(req, reply) {
  if (!req.user || (!['POST','PUT','PATCH','DELETE'].includes(req.method) && !/card-image|receipt|details/.test(req.routeOptions.url))) return
  // No request bodies, names, phone numbers, notes, image content or secrets.
  await prisma.auditEvent.create({ data: {
    actorId: req.user.id, action: req.method, route: req.routeOptions.url,
    targetId: req.params?.id || req.params?.clientId || null,
    statusCode: reply.statusCode, requestId: req.id,
  } }).catch(() => req.log.error({ requestId: req.id }, 'Audit event could not be stored'))
}
