import { httpError } from './errors.js'
export function validatePassword(value, { existing = false } = {}) {
  if (typeof value !== 'string' || value.includes('\0') || value.length < (existing ? 1 : 12) || Buffer.byteLength(value, 'utf8') > (existing ? 512 : 72)) {
    throw httpError(400, existing ? 'Проверьте пароль.' : 'Пароль: минимум 12 символов, не более 72 байт UTF-8.')
  }
  return value
}
