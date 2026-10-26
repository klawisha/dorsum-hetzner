import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'

import { sanitizeImage } from '../../security/image.js'
import { encryptMedia, decryptMedia } from '../../security/media-crypto.js'

import { centerPeriodRange } from '../../utils/finance-range.js'
const monthRange = month => centerPeriodRange('month',month)

function safeName(name, mime) {
  const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg'
  const base = String(name || 'receipt').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 100)
  return base.toLowerCase().endsWith(ext) ? base : `${base.replace(/\.[^.]+$/, '')}${ext}`
}

const metaSelect = {
  id: true, fileName: true, mimeType: true, byteSize: true, createdAt: true, updatedAt: true,
}

export async function expenseRoutes(app) {
  const adminOnly = [authMiddleware, roleMiddleware(['ADMIN'])]

  app.get('/expenses', { preHandler: adminOnly }, async (req) => {
    const { start, end } = monthRange(req.query.month)
    return prisma.expense.findMany({
      where: { purchasedAt: { gte: start, lt: end } },
      include: { receipt: { select: metaSelect } },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
    })
  })

  app.post('/expenses', { preHandler: adminOnly }, async (req, reply) => {
    const title = String(req.body?.title || '').trim()
    const amount = Number(req.body?.amount)
    const note = String(req.body?.note || '').trim()

    if (!title || title.length > 180) return reply.code(400).send({ message: 'INVALID_EXPENSE_TITLE' })
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      return reply.code(400).send({ message: 'INVALID_EXPENSE_AMOUNT' })
    }
    if (note.length > 1500) return reply.code(400).send({ message: 'EXPENSE_NOTE_TOO_LONG' })

    let purchasedAt = new Date()
    if (req.body?.purchasedAt) {
      purchasedAt = new Date(req.body.purchasedAt)
      if (Number.isNaN(purchasedAt.getTime())) return reply.code(400).send({ message: 'INVALID_EXPENSE_DATE' })
    }

    return prisma.expense.create({
      data: {
        title,
        amount: Math.round(amount * 100) / 100,
        purchasedAt,
        note: note || null,
      },
      include: { receipt: { select: metaSelect } },
    })
  })

  app.post('/expenses/:id/void', { preHandler: adminOnly }, async (req, reply) => {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } })
    if (!expense) return reply.code(404).send({ message: 'EXPENSE_NOT_FOUND' })
    if (expense.voidedAt) return expense

    return prisma.expense.update({
      where: { id: expense.id },
      data: {
        voidedAt: new Date(),
        voidReason: String(req.body?.reason || 'Отменено администратором').trim().slice(0, 500),
      },
      include: { receipt: { select: metaSelect } },
    })
  })

  app.put('/expenses/:id/receipt', {
    preHandler: adminOnly,
    bodyLimit: 8 * 1024 * 1024,
  }, async (req, reply) => {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!expense) return reply.code(404).send({ message: 'EXPENSE_NOT_FOUND' })

    const { dataBase64, mimeType, fileName } = req.body || {}
    const { buffer, mimeType: detected } = await sanitizeImage(dataBase64, mimeType)
    const stored = encryptMedia(buffer, 'expense-receipt:' + expense.id)

    return prisma.expenseReceipt.upsert({
      where: { expenseId: expense.id },
      create: {
        expenseId: expense.id, fileName: safeName(fileName, detected),
        mimeType: detected, byteSize: buffer.length, data: stored,
      },
      update: {
        fileName: safeName(fileName, detected),
        mimeType: detected, byteSize: buffer.length, data: stored,
      },
      select: metaSelect,
    })
  })

  app.get('/expenses/:id/receipt', { preHandler: adminOnly }, async (req, reply) => {
    const receipt = await prisma.expenseReceipt.findUnique({
      where: { expenseId: req.params.id },
      select: { fileName: true, mimeType: true, data: true },
    })
    if (!receipt) return reply.code(404).send({ message: 'RECEIPT_NOT_FOUND' })

    reply.header('Content-Type', receipt.mimeType)
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(receipt.fileName)}`)
    reply.header('Cache-Control', 'private, no-store, max-age=0')
    reply.header('X-Content-Type-Options', 'nosniff')
    return reply.send(decryptMedia(receipt.data, 'expense-receipt:' + req.params.id))
  })

  app.delete('/expenses/:id/receipt', { preHandler: adminOnly }, async (req, reply) => {
    const receipt = await prisma.expenseReceipt.findUnique({ where: { expenseId: req.params.id }, select: { id: true } })
    if (!receipt) return reply.code(204).send()
    await prisma.expenseReceipt.delete({ where: { id: receipt.id } })
    return reply.code(204).send()
  })
}
