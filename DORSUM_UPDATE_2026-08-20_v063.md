# Dorsum v0.6.3 — device-independent centre time

- Исправлена архитектурная причина `08:00` на ПК -> `18:00` на телефоне.
- Browser timezone больше не участвует в создании занятия.
- Frontend отправляет `localDate`, `localTime`, `duration`.
- Backend единолично интерпретирует wall-clock время как `Europe/Kyiv`.
- PostgreSQL по-прежнему хранит реальный UTC instant.
- При чтении UTC преобразуется в `Europe/Kyiv` и только затем передаётся FullCalendar как wall-clock строка.
- Availability использует тот же центрированный time contract, поэтому проверка занятости совпадает с созданием.
- Legacy startTime/endTime fallback временно сохранён на backend для безопасного rolling deploy.
- Добавлена безопасная one-time утилита исправления уже сохранённых записей:
  `npm run appointment:set-time -- <id> YYYY-MM-DD HH:MM`
  По умолчанию dry-run; запись выполняется только с `APPLY=YES`.
