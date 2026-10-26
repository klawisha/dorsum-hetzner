import '../src/config/env.js'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcrypt'
import prisma from '../src/config/prisma.js'
import { normalizePhone } from '../src/modules/auth/auth.service.js'
import { validatePassword } from '../src/security/password.js'
try {
  if (!process.argv[2]) throw new Error('Usage: node scripts/reset-password.mjs /private/reset.json')
  const { phone, password } = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  validatePassword(password)
  await prisma.user.update({ where: { phone: normalizePhone(phone) }, data: { password: await bcrypt.hash(password, 12) } })
  console.log('Password reset. All old sessions revoked by the database trigger.')
} finally { await prisma.$disconnect() }
