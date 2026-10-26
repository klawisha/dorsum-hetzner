import '../src/config/env.js'
import prisma from '../src/config/prisma.js'
import { encryptMedia, decryptMedia, isEncryptedMedia } from '../src/security/media-crypto.js'
const apply = process.argv.includes('--apply')
let legacy = 0, checked = 0, changed = 0
try {
  for (const [model, field, prefix] of [['clientCardImage','clientId','client-card:'],['expenseReceipt','expenseId','expense-receipt:']]) {
    let cursor
    while (true) {
      const rows = await prisma[model].findMany({ take: 20, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
      if (!rows.length) break
      for (const row of rows) {
        const context = prefix + row[field]
        if (isEncryptedMedia(row.data)) { decryptMedia(row.data, context); checked++; continue }
        legacy++
        if (apply) {
          const encrypted = encryptMedia(row.data, context)
          if (!decryptMedia(encrypted, context).equals(Buffer.from(row.data))) throw new Error('Media roundtrip failed')
          const result = await prisma[model].updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data: { data: encrypted } })
          if (result.count !== 1) throw new Error('Media changed during migration; stop API and retry')
          changed++
        }
      }
      cursor = rows.at(-1).id
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', legacy, checkedEncrypted: checked, changed }))
} finally { await prisma.$disconnect() }
