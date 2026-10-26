import { pathToFileURL } from 'node:url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import { randomUUID } from 'node:crypto'
import prisma from './config/prisma.js'
import { config } from './config/env.js'
import { validateRequest } from './security/validation.js'
import { safeError } from './security/errors.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { clientRoutes } from './modules/clients/client.routes.js'
import { appointmentRoutes } from './modules/appointments/appointment.routes.js'
import { specialistRoutes } from './modules/specialists/specialist.routes.js'
import { serviceRoutes } from './modules/services/service.routes.js'
import { courseRoutes } from './modules/courses/course.routes.js'
import { financeRoutes } from './modules/finance/finance.routes.js'
import { blockRoutes } from './modules/blocks/block.routes.js'
import { inventoryRoutes } from './modules/inventory/inventory.routes.js'
import { expenseRoutes } from './modules/expenses/expense.routes.js'
import { payrollPolicyRoutes } from './modules/payroll/policy.routes.js'
import { securityRoutes, recordAudit } from './security/audit.js'

export async function buildApp({ logger } = {}) {
  const app = Fastify({
    logger: logger ?? { level: config.logLevel, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'], serializers: {
      req: req => ({ method: req.method, route: req.routeOptions?.url }),
    } },
    trustProxy: config.trustProxy, bodyLimit: 128 * 1024, requestTimeout: 20_000,
    connectionTimeout: 10_000, keepAliveTimeout: 5_000, routerOptions: { maxParamLength: 100 },
    requestIdHeader: false, genReqId: () => randomUUID(),
  })
  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], sandbox: [] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: config.production ? { maxAge: 31536000 } : false,
  })
  await app.register(cookie)
  await app.register(cors, {
    origin: config.origins, credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Dorsum-CSRF'],
  })
  await app.register(rateLimit, {
    max: 600, timeWindow: '1 minute',
    errorResponseBuilder: () => ({ message: 'Слишком много запросов. Повторите позже.' }),
  })
  app.addHook('onRoute', route => {
    if (route.method === 'PUT' && /card-image|receipt/.test(route.url)) {
      route.config = { ...route.config, rateLimit: { max: 20, timeWindow: '1 minute' } }
    }
  })
  app.addHook('preValidation', validateRequest)
  app.addHook('onResponse', recordAudit)
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store, max-age=0')
    reply.header('CDN-Cache-Control', 'no-store')
    reply.header('Vercel-CDN-Cache-Control', 'no-store')
    reply.header('Pragma', 'no-cache')
    reply.header('X-Request-Id', req.id)
    // Reject explicitly untrusted origins, including writes with a stolen token.
    if (req.headers.origin && !config.origins.includes(req.headers.origin)) return reply.code(403).send({ message: 'Источник запроса не разрешён.' })
  })
  app.setErrorHandler((error, req, reply) => {
    const result = safeError(error)
    if (result.statusCode >= 500) req.log.error({ code: error.code || error.name, requestId: req.id }, 'Request failed')
    reply.code(result.statusCode).send({ message: result.message, requestId: req.id })
  })
  // Old controllers return caught exceptions as JSON; never expose their internals.
  app.addHook('onSend', async (req, reply, payload) => {
    if (reply.statusCode >= 500) return JSON.stringify({ message: 'Не удалось выполнить операцию. Повторите позже.' })
    if (reply.statusCode >= 400 && typeof payload === 'string' &&
      /Prisma|Invalid .*(invocation|argument)|DATABASE_URL|password|SELECT |INSERT |node_modules|\.js:\d|PostgreSQL|ECONN|P20\d\d/i.test(payload)) {
      return JSON.stringify({ message: 'Не удалось выполнить операцию. Проверьте данные и повторите.' })
    }
    if (reply.statusCode < 400 && req.user?.role === 'CLIENT' && typeof payload === 'string') {
      const hidden = new Set(['specialistPay','specialistPayPerSession','specialistPayMode','specialistPayPercent','salaryPercent','fixedSalary','payConfig','massageHalfHourTracking','massageTieredPay','massagePayClassMinutes','massageUseHigherOfTierAndFixed'])
      try { return JSON.stringify(JSON.parse(payload), (key,value) => hidden.has(key) ? undefined : value) } catch { /* Non-JSON responses remain unchanged. */ }
    }
    return payload
  })
  app.get('/', async () => ({ ok: true, service: 'dorsum-api' }))
  app.get('/health/live', async () => ({ ok: true }))
  app.get('/health/ready', async (_req, reply) => {
    try { await prisma.$queryRaw`SELECT 1`; return { ok: true } }
    catch { return reply.code(503).send({ ok: false }) }
  })
  for (const routes of [authRoutes,userRoutes,clientRoutes,appointmentRoutes,specialistRoutes,serviceRoutes,courseRoutes,financeRoutes,blockRoutes,inventoryRoutes,expenseRoutes,securityRoutes,payrollPolicyRoutes]) await app.register(routes)
  app.addHook('onClose', async () => prisma.$disconnect())
  return app
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await buildApp()
  const stop = async () => { await app.close(); process.exit(0) }
  process.once('SIGTERM', stop); process.once('SIGINT', stop)
  try { await app.listen({ host: config.host, port: config.port }) }
  catch (error) { app.log.error({ code: error.code || error.name }, 'Startup failed'); process.exit(1) }
}
