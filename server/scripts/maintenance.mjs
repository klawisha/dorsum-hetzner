import '../src/config/env.js'
import prisma from '../src/config/prisma.js'
try {
  const sessions = await prisma.authSession.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 86400_000) } }] } })
  const attempts = await prisma.loginThrottle.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86400_000) } } })
  console.log(JSON.stringify({ expiredSessionsRemoved: sessions.count, oldThrottleRowsRemoved: attempts.count }))
} finally { await prisma.$disconnect() }
