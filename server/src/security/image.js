import sharp from 'sharp'
import { httpError } from './errors.js'
const MAX_BYTES = 5 * 1024 * 1024
const types = new Map([['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']])
sharp.cache({ memory: 24, files: 0, items: 16 })
sharp.concurrency(1)
export async function sanitizeImage(dataBase64, declaredMime) {
  if (typeof dataBase64 !== 'string' || dataBase64.length > Math.ceil(MAX_BYTES / 3) * 4 + 128 || ![...types.values()].includes(declaredMime)) throw httpError(400, 'Выберите JPEG, PNG или WebP размером до 5 МБ.')
  const raw = dataBase64.startsWith('data:') ? dataBase64.slice(dataBase64.indexOf(',') + 1) : dataBase64
  if (!raw || raw.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) throw httpError(400, 'Файл изображения повреждён.')
  const input = Buffer.from(raw, 'base64')
  if (!input.length || input.length > MAX_BYTES) throw httpError(413, 'Размер изображения превышает 5 МБ.')
  try {
    const options = { limitInputPixels: 25_000_000, failOn: 'warning', sequentialRead: true, animated: false }
    const metadata = await sharp(input, options).metadata()
    if (types.get(metadata.format) !== declaredMime || (metadata.pages || 1) !== 1) throw new Error('Invalid image')
    const buffer = await sharp(input, options).rotate().resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90, effort: 4 }).toBuffer()
    if (buffer.length > MAX_BYTES) throw new Error('Output too large')
    return { buffer, mimeType: 'image/webp' }
  } catch { throw httpError(400, 'Не удалось прочитать изображение. Сохраните его как JPEG, PNG или WebP.') }
}
