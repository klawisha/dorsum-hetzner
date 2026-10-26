# Dorsum v0.5.3

- Исправлен Prisma raw SQL вызов advisory transaction lock.
- pg_advisory_xact_lock возвращает PostgreSQL void, поэтому используется $executeRaw вместо $queryRaw.
- Group booking logic/maxClients остаются без изменений.
