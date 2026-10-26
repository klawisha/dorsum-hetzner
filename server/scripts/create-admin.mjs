import '../src/config/env.js'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcrypt'
import prisma from '../src/config/prisma.js'
import { normalizePhone } from '../src/modules/auth/auth.service.js'
import { validatePassword } from '../src/security/password.js'
// Pass credentials through a private JSON file, never command arguments or logs.
const path = process.argv[2]
if (!path) { console.error('Usage: node scripts/create-admin.mjs /private/admin.json'); process.exit(1) }
try {
  const { phone: rawPhone, password, fullName } = JSON.parse(readFileSync(path, 'utf8'))
  const phone = normalizePhone(rawPhone); validatePassword(password)
  if (typeof fullName !== 'string' || fullName.length < 2 || fullName.length > 160) throw new Error('Invalid fullName')
  if (await prisma.user.findUnique({ where: { phone } })) throw new Error('Account exists. Use password recovery tool, not automatic privilege promotion.')
  await prisma.user.create({ data: { phone, password: await bcrypt.hash(password, 12), role: 'ADMIN' } })
  console.log('Administrator created. Credentials were not printed.')
} finally { await prisma.$disconnect() }
