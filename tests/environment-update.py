"""Verify environment writes against synthetic credentials in a temporary checkout."""
from pathlib import Path
import subprocess
import tempfile
import json
import stat

script = Path('scripts/apply-runtime-env.py').resolve()
with tempfile.TemporaryDirectory(prefix='fida-env-test-') as directory:
    checkout = Path(directory) / 'checkout'
    checkout.mkdir()
    path = checkout / '.env'
    original = 'POSTGRES_PASSWORD="fixture-only"\nPUBLIC_BASE_URL=https://old.example.test\n'
    path.write_text(original)
    values = {'PUBLIC_BASE_URL': 'https://new.example.test', 'CORS_ORIGIN': 'https://new.example.test', 'MAINTENANCE_MODE': 'false'}
    result = subprocess.run(['python3', str(script)], input=json.dumps(values), text=True, cwd=checkout, capture_output=True)
    assert result.returncode == 0, result.stderr
    updated = path.read_text()
    assert 'POSTGRES_PASSWORD="fixture-only"' in updated
    assert updated.count('PUBLIC_BASE_URL=') == 1
    assert 'PUBLIC_BASE_URL="https://new.example.test"' in updated
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    backups = list((Path(directory) / 'fida-backups').glob('*'))
    assert len(backups) == 1, 'Backup must be outside the checkout'
    assert backups[0].read_text() == original
    assert stat.S_IMODE(backups[0].stat().st_mode) == 0o600
    assert not (checkout / 'fida-backups').exists()
    for invalid in [{'DATABASE_URL': 'unexpected'}, {'CORS_ORIGIN': 'x\ny'}]:
        result = subprocess.run(['python3', str(script)], input=json.dumps(invalid), text=True, cwd=checkout, capture_output=True)
        assert result.returncode != 0
        assert path.read_text() == updated
print('Environment update: preserved credentials, private external backup, rejected unsupported keys/newlines.')
