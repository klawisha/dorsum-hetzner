import '../src/config/env.js'
import prisma from '../src/config/prisma.js'
import { createHash } from 'node:crypto'
import { decryptMedia, isEncryptedMedia } from '../src/security/media-crypto.js'
const report = {}
try {
  for (const model of ['user','clientProfile','specialistProfile','service','appointment','course','coursePayment','expense','inventorySale','clientCardImage','expenseReceipt']) report[model] = await prisma[model].count()
  for (const [model, field, prefix] of [['clientCardImage','clientId','client-card:'],['expenseReceipt','expenseId','expense-receipt:']]) {
    const digest = createHash('sha256'); let cursor, encrypted = 0
    while (true) {
      const rows = await prisma[model].findMany({ take: 20, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
      if (!rows.length) break
      for (const row of rows) {
        digest.update(row.id); digest.update(decryptMedia(row.data, prefix + row[field]))
        if (isEncryptedMedia(row.data)) encrypted++
      }
      cursor = rows.at(-1).id
    }
    report[model + 'PlaintextSHA256'] = digest.digest('hex'); report[model + 'Encrypted'] = encrypted
  }
  const cash = await prisma.coursePayment.aggregate({ _sum: { amount: true } })
  report.courseCashTotal = cash._sum.amount || 0
  report.paidAppointments = await prisma.appointment.count({ where: { paymentStatus: 'PAID' } })
  console.log(JSON.stringify(report, null, 2))
} finally { await prisma.$disconnect() }
