import dotenv from 'dotenv'
dotenv.config({ quiet: true })
export function loadConfig(source = process.env) {
  const production = source.NODE_ENV === 'production'
  const secret = source.JWT_ACCESS_SECRET || ''
  if (secret.length < 48 || /replace|change|access_secret|example/i.test(secret)) throw new Error('JWT_ACCESS_SECRET requires a unique random secret of at least 48 characters')
  if (!/^postgres(ql)?:\/\//.test(source.DATABASE_URL || '')) throw new Error('DATABASE_URL must be a PostgreSQL URL')
  const origins = (source.APP_ORIGINS || (production ? '' : 'http://localhost:5173')).split(',').map(s => s.trim()).filter(Boolean)
  if (!origins.length) throw new Error('APP_ORIGINS is required')
  for (const origin of origins) {
    const u = new URL(origin)
    if (u.origin !== origin || (production && u.protocol !== 'https:') || u.username || u.password) throw new Error('APP_ORIGINS requires exact HTTPS origins without paths')
  }
  const port = Number(source.PORT || 5000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
  return Object.freeze({
    production, port, secret, origins, host: source.HOST || '127.0.0.1',
    trustProxy: source.TRUST_PROXY ? source.TRUST_PROXY.split(',').map(s => s.trim()) : false,
    cookieName: production ? '__Host-dorsum_refresh' : 'dorsum_refresh',
    registration: source.ALLOW_PUBLIC_REGISTRATION !== 'false',
    logLevel: source.LOG_LEVEL || 'info', sessionDays: 7,
  })
}
export const config = loadConfig()
