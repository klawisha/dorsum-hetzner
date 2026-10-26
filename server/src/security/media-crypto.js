import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { config } from '../config/env.js'
const MAGIC = Buffer.from('DORSUM01')
function mediaKey() {
  const key = Buffer.from(process.env.MEDIA_ENCRYPTION_KEY || '', 'base64')
  if (key.length !== 32) throw new Error('MEDIA_ENCRYPTION_KEY must be 32 random bytes in base64')
  return key
}
if (config.production || process.env.MEDIA_ENCRYPTION_KEY) mediaKey()
export function isEncryptedMedia(data) { return Buffer.from(data).subarray(0, MAGIC.length).equals(MAGIC) }
export function encryptMedia(data, context) {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', mediaKey(), nonce)
  cipher.setAAD(Buffer.from(context))
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()])
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext])
}
export function decryptMedia(data, context) {
  const input = Buffer.from(data)
  if (!isEncryptedMedia(input)) {
    if (process.env.ALLOW_LEGACY_MEDIA === 'false') throw new Error('Unencrypted legacy media needs migration')
    return input
  }
  if (input.length < 36) throw new Error('Invalid encrypted media')
  const decipher = createDecipheriv('aes-256-gcm', mediaKey(), input.subarray(8, 20))
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(input.subarray(20, 36))
  return Buffer.concat([decipher.update(input.subarray(36)), decipher.final()])
}
