import contextlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('dorsum_create_admin', Path(__file__).resolve().parents[1] / 'create-admin.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AdminBootstrapTest(unittest.TestCase):
    def run_bootstrap(self, fail=False, tty=True, passwords=None):
        password = 'Unique-test-password-2026!'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'secrets').mkdir()
            (root / 'secrets/app.env').write_text('test-only')
            observed = []

            def child(command, **kwargs):
                self.assertNotIn(password, repr(command))
                self.assertNotIn(password, repr(kwargs))
                mount = command[command.index('-v') + 1]
                credential_file = Path(mount.split(':/private/')[0])
                self.assertEqual(stat.S_IMODE(credential_file.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(credential_file.parent.stat().st_mode), 0o700)
                self.assertEqual(json.loads(credential_file.read_text())['phone'], '+380000000000')
                self.assertEqual(json.loads(credential_file.read_text())['password'], password)
                self.assertEqual(command[command.index('--user') + 1], '0:0')
                self.assertEqual(kwargs['stdin'], subprocess.DEVNULL)
                observed.append(credential_file)
                return subprocess.CompletedProcess(command, 1 if fail else 0, password, password)

            output = io.StringIO()
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output), \
                 patch.object(module, '__file__', str(root / 'create-admin.py')), \
                 patch.object(module.os, 'geteuid', return_value=0), \
                 patch.object(module.sys.stdin, 'isatty', return_value=tty), \
                 patch.object(module.sys.stderr, 'isatty', return_value=tty), \
                 patch.object(module.shutil, 'which', return_value='/usr/bin/docker'), \
                 patch.object(module.getpass, 'getpass', side_effect=passwords or [password, password]), \
                 patch.object(module.subprocess, 'run', side_effect=child) as invoked:
                code = module.main([])
            self.assertNotIn(password, output.getvalue())
            self.assertTrue(all(not p.exists() for p in observed))
            self.assertEqual(list((root / 'secrets').glob('.admin-create-*')), [])
            return code, invoked.call_count

    def test_private_credential_file_and_cleanup_after_success(self):
        self.assertEqual(self.run_bootstrap(), (0, 1))

    def test_cleanup_and_no_secret_output_after_child_failure(self):
        self.assertEqual(self.run_bootstrap(fail=True), (1, 1))

    def test_noninteractive_terminal_refused_before_password_read(self):
        self.assertEqual(self.run_bootstrap(tty=False), (1, 0))

    def test_mismatch_refused_before_database_command(self):
        self.assertEqual(self.run_bootstrap(passwords=['First-password-2026', 'Different-password-2026']), (1, 0))


if __name__ == '__main__':
    unittest.main()
