import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/dorsum_test'
process.env.JWT_ACCESS_SECRET ||= randomBytes(64).toString('base64url')
process.env.MEDIA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64')
const { loadConfig } = await import('../src/config/env.js')
const { validatePassword } = await import('../src/security/password.js')
const { safeError } = await import('../src/security/errors.js')
const { sanitizeImage } = await import('../src/security/image.js')
const { encryptMedia, decryptMedia } = await import('../src/security/media-crypto.js')
const { bodySchemas } = await import('../src/security/validation.js')
const { centerWallTimeToUtc } = await import('../src/utils/center-time.js')
const sharp = (await import('sharp')).default

test('production fails closed without real secret or explicit origins', () => {
  const base = { NODE_ENV: 'production', DATABASE_URL: process.env.DATABASE_URL, JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET, APP_ORIGINS: 'https://dorsum.example.com' }
  assert.throws(() => loadConfig({ ...base, JWT_ACCESS_SECRET: '' }))
  assert.throws(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'access_secret' }))
  assert.throws(() => loadConfig({ ...base, APP_ORIGINS: '*' }))
  assert.throws(() => loadConfig({ ...base, APP_ORIGINS: 'http://example.com' }))
  assert.throws(() => loadConfig({ ...base, APP_ORIGINS: 'https://example.com/path' }))
  assert.equal(loadConfig(base).trustProxy, false)
})
test('new passwords are strong and bounded by bcrypt byte limit; old short passwords can log in', () => {
  assert.throws(() => validatePassword('short'))
  assert.throws(() => validatePassword('я'.repeat(40)))
  assert.throws(() => validatePassword('a'.repeat(12) + '\0'))
  assert.equal(validatePassword('SixCharacters', { existing: true }), 'SixCharacters')
  assert.equal(validatePassword('a'.repeat(72)).length, 72)
})
test('mass assignment, prototype payloads and forged privileged fields are rejected', () => {
  const schema = bodySchemas.get('POST /clients/profile')
  assert.equal(schema.safeParse({ fullName: 'Client One', userId: 'other', balance: 999 }).success, false)
  assert.equal(bodySchemas.get('POST /auth/register').safeParse({ fullName: 'Client One', phone: '+380671234567', password: 'abc', role: 'ADMIN' }).success, false)
  assert.equal(schema.safeParse(JSON.parse('{"fullName":"Client","__proto__":{"admin":true}}')).success, false)
})
test('negative money, non-boolean flags and excessive durations are rejected', () => {
  const service = bodySchemas.get('PATCH /services/:id')
  for (const value of [{ price: -1 }, { active: 'false' }, { durationMinutes: -1 }, { maxClients: 100000 }]) assert.equal(service.safeParse(value).success, false)
  assert.equal(bodySchemas.get('POST /inventory/sales').safeParse({ itemId: 'id', quantity: 1001 }).success, false)
})
test('unexpected SQL, Prisma and internal errors do not reach clients', () => {
  assert.equal(safeError(new Error('postgresql://secret:secret@db')).statusCode, 500)
  assert.ok(!safeError(new Error('password_hash')).message.includes('password'))
  assert.equal(safeError({ code: 'P2002' }).statusCode, 409)
  assert.equal(safeError({ code: 'P2025' }).statusCode, 404)
})
test('encryption binds media to a record and detects any tampering', () => {
  const input = Buffer.from('private image data')
  const encrypted = encryptMedia(input, 'client-card:client-one')
  assert.ok(!encrypted.includes(input))
  assert.deepEqual(decryptMedia(encrypted, 'client-card:client-one'), input)
  assert.throws(() => decryptMedia(encrypted, 'client-card:client-two'))
  const corrupted = Buffer.from(encrypted); corrupted[corrupted.length - 1] ^= 1
  assert.throws(() => decryptMedia(corrupted, 'client-card:client-one'))
})
test('a complete image is decoded, stripped of metadata and re-encoded', async () => {
  const original = await sharp({ create: { width: 40, height: 50, channels: 3, background: '#1f8560' } }).jpeg().toBuffer()
  const result = await sanitizeImage(original.toString('base64'), 'image/jpeg')
  const meta = await sharp(result.buffer).metadata()
  assert.equal(meta.format, 'webp'); assert.equal(meta.width, 40); assert.equal(meta.height, 50)
  assert.equal(meta.exif, undefined); assert.equal(meta.icc, undefined)
})
test('fake image signatures, SVG, corrupt base64 and MIME spoofing are rejected', async () => {
  const valid = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer()
  for (const [data, mime] of [[Buffer.from('<svg onload="alert(1)"/>').toString('base64'),'image/svg+xml'], ['!!!!','image/jpeg'], [Buffer.from([255,216,255,1]).toString('base64'),'image/jpeg'], [valid.toString('base64'),'image/jpeg']]) await assert.rejects(() => sanitizeImage(data, mime))
})
test('oversized image and oversized pixel count are rejected', async () => {
  await assert.rejects(() => sanitizeImage('A'.repeat(7_000_000), 'image/jpeg'))
  const huge = await sharp({ create: { width: 5100, height: 5100, channels: 3, background: '#fff' } }).png().toBuffer()
  await assert.rejects(() => sanitizeImage(huge.toString('base64'), 'image/png'))
})
test('centre time uses Kyiv timezone and rejects nonexistent dates', () => {
  assert.equal(centerWallTimeToUtc('2026-10-20','15:00').toISOString(), '2026-10-20T12:00:00.000Z')
  assert.throws(() => centerWallTimeToUtc('2026-02-30','15:00'))
  assert.throws(() => centerWallTimeToUtc('2026-10-20','25:00'))
})

const { centerPeriodRange } = await import('../src/utils/finance-range.js')
test('cash periods use Kyiv calendar boundaries even on a UTC server',()=>{
  assert.equal(centerPeriodRange('day','2033-06-10').start.toISOString(),'2033-06-09T21:00:00.000Z')
  assert.equal(centerPeriodRange('day','2033-01-10').start.toISOString(),'2033-01-09T22:00:00.000Z')
})
