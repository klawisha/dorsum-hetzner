# Исправление конфликта адреса Caddy

26 октября 2026. В предыдущем compose.yml адрес Caddy 172.30.18.2 мог быть автоматически выдан API, запущенному первым.
Это объясняет отказ Caddy с Address already in use при работающих API и PostgreSQL. Фактических владельцев адресов можно посмотреть:

~~~bash
cd /opt/dorsum/infra/deploy
docker network inspect dorsum_edge --format '{{range .Containers}}{{println .Name .IPv4Address}}{{end}}'
~~~

Исправленная конфигурация ограничивает автоматическую выдачу адресов диапазоном 172.30.18.128/25 при подсети 172.30.18.0/24.
Шлюз — 172.30.18.1, фиксированный адрес Caddy — 172.30.18.2. TRUST_PROXY в обоих secrets/*.env менять не требуется.

Для уже установленного проекта выполните следующий блок в SSH root-сессии. Сначала сохраняется исходная compose.yml.
После проверки синтаксиса пересоздаются контейнеры и сети проекта. Обычный down сохраняет именованные Docker-тома с БД и сертификатами.
Во время пересоздания сервисы кратковременно остановятся. Ключи и пароли не генерируются заново.

~~~bash
cd /opt/dorsum/infra/deploy
(
set -e
python3 - <<'PY'
from pathlib import Path

path = Path('compose.yml')
text = path.read_text()
old = '        - subnet: 172.30.18.0/24\n'
new = old + '          ip_range: 172.30.18.128/25\n          gateway: 172.30.18.1\n'

if 'ip_range: 172.30.18.128/25' in text:
    print('Диапазон адресов уже исправлен.')
elif 'ip_range:' in text or text.count(old) != 1:
    raise SystemExit('STOP: compose.yml отличается от ожидаемого. Нужна проверка файла.')
else:
    backup = Path('compose.yml.before-network-fix')
    if not backup.exists():
        backup.write_text(text)
    path.write_text(text.replace(old, new, 1))
    print('Диапазон адресов исправлен, исходный файл сохранён.')
PY
docker compose config --quiet
docker compose down
docker compose up -d --wait db api caddy
docker compose ps
)
~~~

Параметр -v к down добавлять нельзя: он удаляет именованные тома.

Проверьте HTTPS после получения сертификата Caddy:

~~~bash
DorsumApiDomain=$(sed -n 's/^API_DOMAIN=//p' .env)
curl --fail --silent --show-error --connect-timeout 5 --max-time 15 --retry 10 --retry-delay 3 --retry-all-errors "https://$DorsumApiDomain/health/ready"
~~~

Если запуск или HTTPS завершается ошибкой, сохраните вывод этих диагностических команд:

~~~bash
docker compose ps -a
docker compose logs --tail=80 caddy
docker network inspect dorsum_edge --format '{{range .Containers}}{{println .Name .IPv4Address}}{{end}}'
ss -ltnp '( sport = :80 or sport = :443 )'
~~~

Перед отправкой исходников на GitHub внесите такой же ip_range и gateway в compose.yml в локальной копии на Windows либо используйте обновлённый архив.
Существующую установку не нужно заново конфигурировать, мигрировать или инициализировать.

В CI проверка Caddy перенесена после запуска API: контейнер Caddy действительно подключается к сети с фиксированным адресом, когда API уже занял динамический адрес.
Так проверяется порядок запуска, в котором проявлялась ошибка. Удалённый CI нужно выполнить в GitHub; здесь Docker недоступен.

Источники:
https://docs.docker.com/reference/cli/docker/network/connect/
https://docs.docker.com/reference/compose-file/networks/
https://docs.docker.com/reference/cli/docker/compose/down/
