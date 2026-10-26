import '../src/config/env.js'
import prisma from '../src/config/prisma.js'
import { ensureServiceCatalog } from '../src/modules/services/service.routes.js'
try { await ensureServiceCatalog(); console.log('Only missing catalogue services added. Existing prices preserved.') }
finally { await prisma.$disconnect() }
