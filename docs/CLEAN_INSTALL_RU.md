# Чистая установка Dorsum 2.1.0 — актуальный сценарий

26 октября 2026. По решению владельца создаётся новая БД: перенос клиентов, оплат и фотографий из старой системы не выполняется.
Администратор: +380000000000. Пароль вводится владельцем на VPS, в архиве пароля нет.

Регистрацию Hetzner, ключи SSH, домен, новый GitHub и настройку Vercel выполняйте по HETZNER_VERCEL_RU.md и инструкции в чате.
После установки Docker и единственного запуска configure.py выполните следующий порядок на НОВОМ VPS.
Ранее созданные рабочие БД и volumes этот порядок не удаляет.

## 1. Создать схему и выдать рабочие права
~~~bash
cd /opt/dorsum/infra/deploy
docker compose config --quiet
docker compose build api
docker compose up -d --wait db
docker compose run --rm --no-deps migrate
docker compose exec -T db psql -X -U dorsum_owner -d dorsum -f /ops/db-grants.sql >/dev/null
~~~

## 2. Подготовить каталог
Миграции и seed добавляют начальные услуги. В редакторе проверьте фактические цены и выплаты центра.
~~~bash
docker compose run --rm --no-deps -T api node scripts/seed-catalog.mjs
sed -i 's/^ALLOW_LEGACY_MEDIA=true$/ALLOW_LEGACY_MEDIA=false/' secrets/app.env secrets/migrate.env
~~~
Старых файлов в новой БД нет; encrypt-media.mjs для этой установки не нужен.
MEDIA_ENCRYPTION_KEY всё равно сохраните: он используется новыми фотографиями.

## 3. Создать администратора до публичного запуска API
В интерактивной SSH root-сессии:
~~~bash
python3 create-admin.py --phone +380000000000
~~~
Скрипт дважды запросит пароль, символы при вводе не отображаются.
Пароль: минимум 12 символов и максимум 72 байта UTF-8; рекомендуется уникальный пароль от 16 символов.
Он не передаётся аргументом команды и не попадает в историю оболочки.
Временный JSON-файл имеет права 600 в приватном каталоге и удаляется при штатном завершении, ошибке дочерней команды или Ctrl+C.
Если номер уже существует, существующий аккаунт не изменяется и не повышается до ADMIN.
Пароль сохраняется в БД в виде bcrypt-хеша.

Проверка без вывода хеша:
~~~bash
docker compose exec -T db psql -X -U dorsum_owner -d dorsum <<'SQL'
SELECT phone, role, active FROM "User" WHERE phone = '+380000000000';
SQL
~~~
Ожидается ADMIN и active=true.

## 4. Запустить приложение
В исправленной compose.yml автоматическая выдача адресов сети edge ограничена диапазоном 172.30.18.128/25.
Адрес Caddy 172.30.18.2 находится вне этого диапазона; TRUST_PROXY остаётся 172.30.18.2.
Если сеть уже создана предыдущей версией и Caddy выдаёт Address already in use, выполните docs/NETWORK_FIX_RU.md перед запуском.
~~~bash
docker compose up -d --wait api
docker compose up -d caddy
DorsumApiDomain=$(sed -n 's/^API_DOMAIN=//p' .env)
curl --fail --retry 10 --retry-delay 3 --retry-all-errors "https://$DorsumApiDomain/health/ready"
~~~
Затем подключите frontend Vercel к новому репозиторию: Root Directory=client, Node.js=22, VITE_API_URL=/api.
Вход на сайте: телефон +380000000000 и введённый вами пароль.

## 5. Резервные копии
Настройте age, Storage Box и timers по основной инструкции. Выполните backup.sh и restore-check.sh в отдельную тестовую БД.
Для исходной проверки файлов можно создать baseline новой БД:
~~~bash
umask 077
docker compose run --rm --no-deps -T api node scripts/storage-check.mjs > backups/clean-baseline.json
~~~
Для побайтного сравнения восстановленной БД с baseline делайте снимок и проверку в период без записей в систему.
Сохраните ключ age и зашифрованную конфигурацию отдельно от VPS.

## Проверки нового помощника
~~~bash
python3 -m unittest discover -s infra/deploy/tests -v
~~~
Из корня Dorsum; используются синтетические данные и подмена Docker-вызова.
Проверены права и удаление временного файла, отсутствие пароля в аргументах и выводе, отказ без TTY и при несовпадении паролей.
Реальный Docker и аккаунт создаются только при выполнении инструкции владельцем на VPS.
