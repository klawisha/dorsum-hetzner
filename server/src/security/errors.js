export function httpError(statusCode, message, code) {
  return Object.assign(new Error(message), { statusCode, code, expose: true })
}
export function safeError(error) {
  if (error?.code === 'P2002') return { statusCode: 409, message: 'Такая запись уже существует.' }
  if (error?.code === 'P2025') return { statusCode: 404, message: 'Запись не найдена.' }
  if (error?.code === 'P2003') return { statusCode: 409, message: 'Запись связана с другими данными.' }
  if (error?.code === 'P2034') return { statusCode: 409, message: 'Данные изменились. Обновите страницу и повторите действие.' }
  const statusCode = error?.statusCode >= 400 && error?.statusCode < 500 ? error.statusCode : 500
  if (error?.validation || error?.name === 'ZodError') return { statusCode: 400, message: 'Проверьте заполненные поля.' }
  return { statusCode, message: statusCode < 500 && error?.expose ? error.message
    : statusCode === 429 ? 'Слишком много запросов. Повторите позже.'
    : statusCode === 413 ? 'Файл или запрос слишком большой.'
    : statusCode === 401 ? 'Войдите в аккаунт.'
    : statusCode === 403 ? 'Недостаточно прав.'
    : statusCode === 404 ? 'Запись не найдена.'
    : statusCode === 400 || statusCode === 415 ? 'Некорректный запрос.'
    : 'Не удалось выполнить операцию. Повторите позже.' }
}
