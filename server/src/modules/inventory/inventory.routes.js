import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'

import { centerPeriodRange } from '../../utils/finance-range.js'
const monthRange = month => centerPeriodRange('month',month)

export async function inventoryRoutes(app) {
  const adminOnly = [authMiddleware, roleMiddleware(['ADMIN'])]

  app.get('/inventory/items', { preHandler: adminOnly }, async () => {
    return prisma.inventoryItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  })

  app.patch('/inventory/items/:id', { preHandler: adminOnly }, async (req, reply) => {
    const data = {}

    if (req.body?.price !== undefined) {
      const price = Number(req.body.price)
      if (!Number.isFinite(price) || price < 0) {
        return reply.code(400).send({ message: 'INVALID_PRICE' })
      }
      data.price = price
    }

    if (req.body?.active !== undefined) {
      data.active = Boolean(req.body.active)
    }

    return prisma.inventoryItem.update({
      where: { id: req.params.id },
      data,
    })
  })

  app.get('/inventory/sales', { preHandler: adminOnly }, async (req) => {
    const { start, end } = monthRange(req.query.month)

    return prisma.inventorySale.findMany({
      where: { soldAt: { gte: start, lt: end } },
      include: { item: true, client: true },
      orderBy: { soldAt: 'desc' },
    })
  })

  app.post('/inventory/sales', { preHandler: adminOnly }, async (req, reply) => {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.body?.itemId },
    })

    if (!item || !item.active) {
      return reply.code(404).send({ message: 'INVENTORY_ITEM_NOT_AVAILABLE' })
    }

    const quantity = Number(req.body?.quantity || 1)
    const unitPrice = req.body?.unitPrice === undefined || req.body?.unitPrice === ''
      ? Number(item.price)
      : Number(req.body.unitPrice)

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return reply.code(400).send({ message: 'INVALID_QUANTITY' })
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return reply.code(400).send({ message: 'INVALID_PRICE' })
    }

    if (unitPrice <= 0) {
      return reply.code(400).send({ message: 'SET_INVENTORY_PRICE' })
    }

    let clientId = req.body?.clientId || null
    if (clientId) {
      const client = await prisma.clientProfile.findUnique({ where: { id: clientId } })
      if (!client) return reply.code(400).send({ message: 'CLIENT_NOT_FOUND' })
    }

    return prisma.inventorySale.create({
      data: {
        itemId: item.id,
        clientId,
        quantity,
        unitPrice,
        total: Math.round(unitPrice * quantity * 100) / 100,
        note: String(req.body?.note || '').trim().slice(0, 1000) || null,
      },
      include: { item: true, client: true },
    })
  })

  app.post('/inventory/sales/:id/void', { preHandler: adminOnly }, async (req, reply) => {
    const sale = await prisma.inventorySale.findUnique({ where: { id: req.params.id } })
    if (!sale) return reply.code(404).send({ message: 'SALE_NOT_FOUND' })
    if (sale.voidedAt) return sale

    return prisma.inventorySale.update({
      where: { id: sale.id },
      data: {
        voidedAt: new Date(),
        voidReason: String(req.body?.reason || 'Отменено администратором').trim().slice(0, 500),
      },
      include: { item: true, client: true },
    })
  })
}
