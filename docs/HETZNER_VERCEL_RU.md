# Dorsum 2.1.0 — перенос на Hetzner и Vercel
20 октября 2026. Основа — Dorsum stable 2.0.16.
Инструкция уточнена 26 октября 2026; исходники приложения 2.1.0 не менялись.
Актуальное решение владельца — чистая установка без переноса старой БД: используйте CLEAN_INSTALL_RU.md для создания схемы и администратора +380000000000. Разделы экспорта/импорта ниже нужны только при выборе переноса.
Команды первоначальной установки рассчитаны на НОВЫЙ VPS Ubuntu 24.04 x86_64.

## 1. Что оформить
- Hetzner Cloud: https://console.hetzner.com, включить 2FA.
- VPS в Германии/Финляндии: ориентир 2 vCPU, 4 ГБ RAM, 80 ГБ SSD, публичный IPv4, Backups.
- Домен центра и доступ к DNS. Frontend остаётся в существующем проекте Vercel.
- Доступ к репозиторию, Render и исходной PostgreSQL.
- Внешние резервные копии: рекомендуется отдельный Storage Box с SSH или другое хранилище.
- Для коммерческого сайта нужен подходящий коммерческий тариф Vercel; Hobby ограничен личным некоммерческим использованием.
Отдельные S3/R2 для фотографий этой версии не требуются.

В примерах api.example.com и YOUR-PROJECT.vercel.app замените настоящими адресами.
Текущий адрес БД найдите в DATABASE_URL на Render: сама БД может быть у другого провайдера.

## 2. Подготовить исходники и проверку CI
Распакуйте архив. В папке Dorsum находятся client, server, infra, docs.
При замене D:\Dorsum сохраните .git и ваши локальные .env; не применяйте robocopy /MIR.
node_modules и Prisma Client генерируются установкой, в исходники не вложены.
В client/vercel.json замените api.YOUR-DOMAIN.example своим API-доменом.

В существующем репозитории:
~~~powershell
cd D:\Dorsum
git switch -c security/hetzner-2.1.0
git add .
git commit -m "Dorsum 2.1.0: security, Hetzner, catalogue and payroll"
git push -u origin security/hetzner-2.1.0
~~~
Проверьте git status перед коммитом: секреты, дампы и ключи не должны попасть в Git.
В GitHub → Actions должны пройти server, client и docker.
CI проверяет настоящий PostgreSQL 18, включая конкурентные операции.
Не сливайте ветку в production до готовности нового API и успешных проверок.

## 3. SSH-ключ и сервер
PowerShell:
~~~powershell
ssh-keygen -t ed25519 -C "dorsum-admin" -f "$env:USERPROFILE\.ssh\dorsum"
Get-Content "$env:USERPROFILE\.ssh\dorsum.pub"
~~~
Уже существующий ключ не перезаписывайте. В Hetzner добавляется только .pub.
В Hetzner Console: проект Dorsum → Servers → Add Server.
Выберите Ubuntu 24.04, x86_64, Германию/Финляндию, SSH-ключ, IPv4 и Backups.
Имя: dorsum-prod-01. Сохраните IP.

Привяжите Cloud Firewall:
- TCP 22 — ваш административный IP;
- TCP 80,443 — интернет;
- 5000 и 5432 не открывать.
Если административный IP меняется, обновляйте правило через Console.
Отдельные Hetzner Volumes не входят в серверные Backups. В нашем Compose данные хранятся на системном диске.

## 4. DNS
Создайте A-запись api → IPv4 VPS.
Удалите устаревшую AAAA для api, если IPv6 не используете.
Адрес frontend на Vercel менять не требуется.
Первую настройку API выполняйте без дополнительного CDN-прокси.

## 5. Загрузить проект
На Windows:
~~~powershell
$VpsIp = "IP_ВАШЕГО_VPS"
scp -i "$env:USERPROFILE\.ssh\dorsum" "$env:USERPROFILE\Downloads\Dorsum-2.1.0-Security-Hetzner.zip" ("root@" + $VpsIp + ":/root/dorsum.zip")
ssh -i "$env:USERPROFILE\.ssh\dorsum" ("root@" + $VpsIp)
~~~
Сравните SSH fingerprint с консолью Hetzner при первом подключении.
Далее на НОВОМ VPS:
~~~bash
apt-get update
apt-get install -y unzip
test ! -e /opt/dorsum
unzip -q /root/dorsum.zip -d /opt
mv /opt/Dorsum /opt/dorsum
cd /opt/dorsum
bash infra/deploy/install-host.sh
~~~
Если /opt/dorsum уже существует, этот порядок не повторяйте.
install-host.sh устанавливает Docker из официального apt-репозитория, Compose, age, rsync, fail2ban, обновления безопасности и время Europe/Kyiv.

## 6. Конфигурация
Один раз:
~~~bash
cd /opt/dorsum/infra/deploy
python3 configure.py \
  --api-domain api.example.com \
  --app-origin https://YOUR-PROJECT.vercel.app \
  --email YOUR_EMAIL
docker compose config --quiet
docker compose build api
docker compose up -d db
~~~
APP_ORIGINS — точный HTTPS Origin frontend без завершающего /.
Для preview добавляйте только конкретный preview Origin; wildcard для vercel.app запрещён.
Секреты создаются в secrets/app.env, secrets/migrate.env и файлах паролей БД.
configure.py не перезаписывает существующие ключи.

Сохраните MEDIA_ENCRYPTION_KEY отдельно от VPS. Он нужен для восстановления фотографий.
Сохраните также JWT_ACCESS_SECRET, пароли БД и конфигурацию.
Ни один из этих секретов не должен попадать в frontend/Vercel VITE_ переменные.

## 7. Экспорт и импорт
Сначала полностью подготовьте VPS и соберите образ.
Затем объявите технический перерыв и остановите ВСЕ записи через старый Render backend.
Не допускайте работы старого и нового backend на двух независимых копиях БД.

Создайте приватный файл:
~~~bash
cd /opt/dorsum/infra/deploy
cp source-db.env.example secrets/source-db.env
chmod 600 secrets/source-db.env
nano secrets/source-db.env
~~~
Заполните PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD по DIRECT внешнему подключению исходной БД.
Оставьте PGSSLMODE=verify-full, PGSSLROOTCERT=system.
При ограничениях провайдера разрешите подключение с IP VPS.
Не вставляйте URL/пароль в команду оболочки, чат или Git.

После остановки старых записей:
~~~bash
bash export-render.sh
ls -lh backups/render-*.dump
~~~
Подставьте имя именно последнего файла:
~~~bash
bash import-empty-db.sh /opt/dorsum/infra/deploy/backups/render-YYYYMMDDTHHMMSSZ.dump
docker compose run --rm --no-deps migrate
docker compose exec -T db psql -X -U dorsum_owner -d dorsum -f /ops/db-grants.sql >/dev/null
bash verify-import.sh
~~~
При первом переносе API и Caddy пока не запускайте: сначала сверка импорта и шифрование старых файлов.
deploy.sh предназначен для последующих обновлений подготовленной системы.
Импорт разрешён только в пустую целевую БД.
Проверка сравнивает количества сущностей, денежные суммы и отпечатки содержимого фотографий/чеков.
Выполняйте её ДО шифрования старых изображений и пока исходная БД остановлена.

Если миграция не прошла, не выполняйте migrate reset и не удаляйте volume.
Сохранены 20 исторических миграций, добавлены 3 новые.
Прайс не перезаписывается при запуске API.

## 8. Фото и чеки
Они находятся в PostgreSQL: ClientCardImage.data и ExpenseReceipt.data.
Дамп переносит их вместе с БД. Новые файлы полностью декодируются, очищаются от метаданных, перекодируются и шифруются.

Во время технического перерыва:
~~~bash
cd /opt/dorsum/infra/deploy
umask 077
docker compose stop api
docker compose run --rm --no-deps -T api node scripts/storage-check.mjs > backups/media-before.json
docker compose run --rm --no-deps -T api node scripts/encrypt-media.mjs
docker compose run --rm --no-deps -T api node scripts/encrypt-media.mjs --apply
docker compose run --rm --no-deps -T api node scripts/storage-check.mjs > backups/media-after.json
~~~
До/после должны совпасть количества файлов и поля:
clientCardImagePlaintextSHA256, expenseReceiptPlaintextSHA256.
Счётчики Encrypted должны стать равны количеству соответствующих файлов.
Миграция шифрования сохраняет исходные байты старых изображений.

После успешной сверки:
~~~bash
sed -i 's/^ALLOW_LEGACY_MEDIA=true$/ALLOW_LEGACY_MEDIA=false/' secrets/app.env secrets/migrate.env
docker compose up -d --no-deps --force-recreate api
docker compose up -d caddy
curl --fail --retry 10 --retry-delay 3 --retry-all-errors https://api.example.com/health/ready
~~~

## 9. Vercel
В существующем Project:
- Root Directory: client;
- Framework: Vite;
- Build: npm run build;
- Output: dist;
- Environment Variables: VITE_API_URL=/api;
- первый rewrite в client/vercel.json: /api/:path* → HTTPS нового API.
Удалите старый Render URL из VITE_API_URL.

Настроенный на VPS client/vercel.json скопируйте в локальный репозиторий либо внесите такой же API-домен вручную.
После зелёного CI слейте ветку в production и выполните deploy/redeploy.
Изменение переменной требует новой сборки.
Refresh-cookie работает через тот же адрес frontend /api, включая frontend на vercel.app.
Рабочие секреты на Vercel не загружаются.

~~~bash
curl --fail https://YOUR-PROJECT.vercel.app/api/health/ready
~~~
Старые токены перестанут действовать: пользователи войдут заново.
Старые пароли продолжают работать; новые: минимум 12 символов, максимум 72 байта UTF-8.

## 10. Проверить приложение
- Вход/выход всех трёх ролей, перезагрузка страницы.
- Android, iPhone/Safari, планшет, поворот экрана, нижние кнопки и модальный редактор занятия.
- Реальная карточка клиента и чек: открываются только у разрешённых ролей.
- Два ребёнка на одном телефоне: разные карточки и независимые курсы.
- Согласованный режим общего номера сохранён: при нескольких клиентах вход по этому номеру отключён, администратор работает с отдельными карточками.
- Прайс / Выплаты → Детский курс: укажите реальные цену, количество занятий и выплату.
- Для групп включите нужный режим, лимит и выплату за участника/сеанс. Существующие настройки сохранены.
- Заполнение группы до лимита, конфликт со специалистом и его окном отсутствия.
- Половина курса, блокировка после половины, доплата и повтор запроса доплаты.
- Изменение разовая услуга ↔ курс и перенос просроченного SCHEDULED в будущее.
- Старые цены/ставки после изменения прайса.
- Касса за день/месяц, зарплата только COMPLETED, расходы и возвраты.

Детские цены и неизвестные лимиты не выдуманы: они задаются центром в редакторе.
Изменение прайса не пересчитывает ранее созданные записи и проданные курсы.
У групповой общей выплаты сумма и правило сохраняются по первой записи сеанса.

## 11. Backup и восстановление
На VPS:
~~~bash
umask 077
age-keygen -o /root/dorsum-age-key.txt
cd /opt/dorsum/infra/deploy
cp backup.env.example secrets/backup.env
chmod 600 secrets/backup.env
nano secrets/backup.env
~~~
Вставьте показанный публичный recipient age1... в AGE_RECIPIENT.
Приватный age-ключ скачайте на ПК и сохраните ещё одну защищённую копию. Ежедневному backup он не нужен.
~~~bash
bash backup.sh
~~~
Для защищённой копии конфигурации:
~~~bash
tar -C /opt/dorsum/infra/deploy -czf - secrets | age -r AGE1_PUBLIC_RECIPIENT -o /root/dorsum-secrets.tar.gz.age
~~~
Скачайте зашифрованную конфигурацию и age-ключ отдельно.

Для внешнего backup закажите Storage Box, включите SSH Support, заведите отдельный SSH-ключ.
Проверьте host fingerprint и добавьте его в known_hosts; не выключайте StrictHostKeyChecking.
Создайте удалённый каталог dorsum.
В secrets/backup.env задайте STORAGE_BOX_HOST, STORAGE_BOX_USER, STORAGE_BOX_KEY.
SSH/rsync использует порт 23. Загружаются зашифрованные дампы.
Локально хранится 14 дней; удалённую политику хранения задайте отдельно.

Для нового ключа автоматического backup на VPS (существующий ключ не перезаписывать):
~~~bash
ssh-keygen -t ed25519 -f /root/.ssh/dorsum-storagebox -N '' -C dorsum-backup
cat /root/.ssh/dorsum-storagebox.pub | ssh -p 23 uXXXXX@uXXXXX.your-storagebox.de install-ssh-key
ssh -p 23 -i /root/.ssh/dorsum-storagebox uXXXXX@uXXXXX.your-storagebox.de mkdir dorsum
~~~
Первое соединение — с паролем Storage Box и проверкой fingerprint по разделу SSH host keys:
https://docs.hetzner.com/storage/storage-box/general/
install-ssh-key добавляет ключ, сохраняя ранее установленные ключи.
Вместо uXXXXX и хоста подставьте выданные Hetzner значения.
После заполнения backup.env повторите bash backup.sh и проверьте появление .dump.age на Storage Box.

После успешного ручного backup:
~~~bash
cp dorsum-backup.service dorsum-backup.timer /etc/systemd/system/
cp dorsum-maintenance.service dorsum-maintenance.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dorsum-backup.timer dorsum-maintenance.timer
systemctl list-timers dorsum-backup.timer dorsum-maintenance.timer
~~~
Backup — около 03:15 по Киеву; очистка истёкших сессий — около 04:00.
Следите за systemctl --failed, журналом backup и свободным диском.
Последняя успешная копия: backups/last-success.txt.

Пробное восстановление в ОТДЕЛЬНУЮ БД:
~~~bash
bash restore-check.sh /ABSOLUTE/PATH/dorsum-YYYYMMDDTHHMMSSZ.dump.age /PATH/TO/PRIVATE/age-key.txt
~~~
Production не перезаписывается. После сверки удалите проверочную БД отдельной командой.
Восстановление фото требует прежнего MEDIA_ENCRYPTION_KEY из копии конфигурации.
После успешного пробного восстановления удалите приватный age-ключ с VPS.
Фактические pg_dump/restore и отправка на Storage Box проверяются на вашем VPS.

## 12. SSH после запуска
~~~bash
adduser deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
~~~
В НОВОМ терминале проверьте deploy по ключу и sudo -v.
Только после этого отключайте root/парольный вход. Оставьте текущую сессию открытой до проверки.
После правок: sshd -t; проверка sshd -T; systemctl reload ssh.

После успешной проверки deploy создайте конфигурацию:
~~~bash
cat > /etc/ssh/sshd_config.d/00-dorsum.conf <<'EOF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t
sshd -T | grep -E 'pubkeyauthentication|passwordauthentication|kbdinteractiveauthentication|permitrootlogin'
systemctl reload ssh
~~~
Снова проверьте новый вход deploy. Все дальнейшие команды администратора выполняйте после sudo -i.

## 13. Пустая установка и забытый пароль
Существующие аккаунты переносятся дампом, заново создавать их не нужно.
Только для пустой установки создайте secrets/admin.json с phone/password/fullName, права 600:
~~~bash
docker compose run --rm --no-deps -T --user 0:0 -v "$PWD/secrets/admin.json:/private/admin.json:ro" api node scripts/create-admin.mjs /private/admin.json
rm secrets/admin.json
~~~
Одноразовая команда запускается с --user 0:0, чтобы прочитать приватный root-owned файл 600; постоянно работающий API остаётся без root.
Для сброса создайте приватный secrets/reset.json с phone/password и выполните:
~~~bash
docker compose run --rm --no-deps -T --user 0:0 -v "$PWD/secrets/reset.json:/private/reset.json:ro" api node scripts/reset-password.mjs /private/reset.json
rm secrets/reset.json
~~~
Сброс отзовёт все прежние сессии.
Для пустого прайса:
~~~bash
docker compose run --rm --no-deps -T api node scripts/seed-catalog.mjs
~~~
Seed добавляет только отсутствующие услуги, действующие цены/доли не меняет.

## 14. Обновления и откат
Сохраняйте secrets, .env и volumes. Перед обновлением делайте encrypted backup.
Новый релиз → новая RELEASE_TAG; MEDIA_ENCRYPTION_KEY сохраняется.
bash deploy.sh собирает образ, останавливает старый API, применяет миграции и проверяет readiness.
Не возвращайте старый frontend с localStorage-токенами к новому backend.

Пока новый backend не принимал записей, можно вернуть frontend и старый backend к исходной БД.
После появления новых записей/оплат простой возврат на Render потеряет их: нужен обратный перенос актуальной БД.
Старый backend не должен оставаться доступным для записей после переключения.
Старую БД удаляйте только после проверки переноса и backup.

Не используйте docker compose down -v, prisma migrate reset или удаление каталога PostgreSQL как способ исправить запуск.

## Диагностика
~~~bash
cd /opt/dorsum/infra/deploy
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 caddy
bash health-check.sh
journalctl -u dorsum-backup.service -n 50 --no-pager
df -h /
~~~

## Источники
https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/
https://docs.hetzner.com/cloud/firewalls/getting-started/creating-a-firewall/
https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/
https://docs.hetzner.com/cloud/volumes/overview/
https://docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg/
https://docs.hetzner.com/storage/storage-box/ssh-keys/add-ssh-keys/
https://docs.hetzner.com/storage/storage-box/general/
https://docs.docker.com/engine/install/ubuntu/
https://hub.docker.com/_/postgres
https://vercel.com/docs/routing/rewrites
https://vercel.com/docs/plans/hobby
https://render.com/docs/postgresql-backups

