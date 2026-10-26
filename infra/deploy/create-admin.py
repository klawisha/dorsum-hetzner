#!/usr/bin/env python3
"""Create an administrator with an interactive password, without shell secrets."""
import argparse
import getpass
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import warnings


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phone', default='+380000000000')
    parser.add_argument('--full-name', default='Администратор')
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parent

    if os.geteuid() != 0:
        print('Запустите из root-сессии: sudo -i.', file=sys.stderr)
        return 1
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        print('Нужен интерактивный SSH-терминал для скрытого ввода пароля.', file=sys.stderr)
        return 1
    docker = shutil.which('docker')
    if not docker:
        print('Docker не найден. Сначала выполните install-host.sh.', file=sys.stderr)
        return 1
    secrets = root / 'secrets'
    if not (secrets / 'app.env').is_file():
        print('Сначала выполните configure.py, миграции и db-grants.sql.', file=sys.stderr)
        return 1

    print('Создание ADMIN для номера ' + args.phone)
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        password = getpass.getpass('Новый пароль: ')
        confirm = getpass.getpass('Повторите пароль: ')
    if password != confirm:
        print('Пароли не совпали. Запустите команду заново.', file=sys.stderr)
        return 1
    if '\0' in password or len(password) < 12 or len(password.encode('utf-8')) > 72:
        print('Пароль: минимум 12 символов, максимум 72 байта UTF-8.', file=sys.stderr)
        return 1

    # The host directory is private; the mounted file is read only by this one-shot root task.
    os.chmod(secrets, 0o700)
    with tempfile.TemporaryDirectory(prefix='.admin-create-', dir=secrets) as temp:
        credentials = Path(temp) / 'admin.json'
        fd = os.open(credentials, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            json.dump({'phone': args.phone, 'password': password, 'fullName': args.full_name}, output)
        command = [
            docker, 'compose', 'run', '--rm', '--no-deps', '-T', '--user', '0:0',
            '-v', str(credentials) + ':/private/admin.json:ro',
            'api', 'node', 'scripts/create-admin.mjs', '/private/admin.json',
        ]
        result = subprocess.run(command, cwd=root, stdin=subprocess.DEVNULL, capture_output=True, text=True)
        # Do not print child errors, which might contain credential payloads from third-party tools.
        if result.returncode:
            print('Создание не выполнено. Проверьте БД, миграции, db-grants.sql и отсутствие аккаунта с этим номером. Существующий аккаунт автоматически не изменяется.', file=sys.stderr)
            return 1
    print('Администратор создан: ' + args.phone + '. Временный файл пароля удалён.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nСоздание отменено.', file=sys.stderr)
        raise SystemExit(130)
    except getpass.GetPassWarning:
        print('Скрытый ввод недоступен. Подключитесь обычным SSH-терминалом.', file=sys.stderr)
        raise SystemExit(1)
