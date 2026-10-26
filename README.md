# Dorsum 2.1.0
Полный проект на основе stable 2.0.16: React/Vite, Fastify, Prisma/PostgreSQL.

Актуальный сценарий владельца: новая БД и администратор +380000000000 с интерактивным вводом пароля. Начните с docs/CLEAN_INSTALL_RU.md.

- docs/HETZNER_VERCEL_RU.md — пошаговый перенос с Render, VPS, DNS, HTTPS, Vercel, фото, backup.
- docs/SECURITY_AND_CHANGES_RU.md — найденные риски, функции, финансовые правила и границы проверок.
- docs/verification — фактические результаты проверок.
- infra/deploy — Compose и эксплуатационные скрипты.
- .github/workflows/security.yml — backend, frontend, PostgreSQL 18 и контейнеры.

Добавлены Прайс / Выплаты, детские курсы и группы, фиксированные/процентные ставки, сохранение прежних цен и выплат, дневная/месячная касса, безопасная отмена курса.
Последние изменения календаря и адаптивности stable 2.0.16 сохранены.
Рабочие секреты, БД пациентов, node_modules и сгенерированный Prisma Client не вложены.

## Локально
Node.js 22.12+ (рекомендуется 22) и PostgreSQL.
Создайте server/.env по примеру с уникальными случайными ключами.
MEDIA_ENCRYPTION_KEY — 32 случайных байта в base64.
~~~
cd server
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
~~~
В другом терминале:
~~~
cd client
npm ci
npm run dev
~~~
Frontend обращается к API через Vite proxy /api.

## Проверки
~~~
cd server
npm test
# Интеграция — только отдельная dorsum_test с применёнными миграциями:
# TEST_DATABASE_URL=... npm run test:integration
cd ../client
npm run lint
npm run build
npx playwright install chromium
npm run test:ui
~~~
Исторические DORSUM_UPDATE_* описывают старые версии. Для развёртывания используйте docs/HETZNER_VERCEL_RU.md.
