#!/usr/bin/env python3
"""Apply exported runtime settings to .env without shell evaluation or secret output."""
import json,os,re,shutil,sys,tempfile
from datetime import datetime,timezone
from pathlib import Path
values=json.load(sys.stdin)
allowed={'PUBLIC_BASE_URL','CORS_ORIGIN','ADMIN_ALLOWED_IPS','MAINTENANCE_MODE','FEATURED_STORE_IDS'}
if not isinstance(values,dict) or set(values)-allowed: raise SystemExit('Unexpected setting key.')
for key,value in values.items():
    if not isinstance(value,str) or any(c in value for c in '\r\n\0'):raise SystemExit('Invalid environment value.')
path=Path('.env');original=path.read_text();stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=path.parent.parent/'fida-backups'/f'env-{stamp}.backup';backup.parent.mkdir(exist_ok=True);shutil.copy2(path,backup);backup.chmod(0o600)
lines=[line for line in original.splitlines() if not any(re.match(r'^\s*'+re.escape(key)+r'\s*=',line) for key in values)]
# Compose expands dollar signs; doubled dollars preserve literal values.
lines.extend(f'{key}={json.dumps(value.replace("$","$$"))}' for key,value in values.items())
fd,name=tempfile.mkstemp(dir=path.parent,prefix='.env-update-')
try:
    os.fchmod(fd,0o600)
    with os.fdopen(fd,'w') as stream:stream.write('\n'.join(lines)+'\n');stream.flush();os.fsync(stream.fileno())
    os.replace(name,path)
finally:
    if os.path.exists(name):os.unlink(name)
print('Environment updated; backup:',backup)
