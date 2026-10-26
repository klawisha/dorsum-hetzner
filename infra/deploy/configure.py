#!/usr/bin/env python3
"""Generate unique private credentials and same-origin Vercel configuration."""
import argparse, json, os, pathlib, secrets, urllib.parse, base64
p=argparse.ArgumentParser()
p.add_argument('--api-domain',required=True)
p.add_argument('--app-origin',required=True)
p.add_argument('--email',required=True)
a=p.parse_args()
if any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789.-' for c in a.api_domain.lower()) or '.' not in a.api_domain or a.api_domain.startswith('-'):
    p.error('Use a real API DNS name without https:// or paths')
u=urllib.parse.urlsplit(a.app_origin)
if u.scheme!='https' or not u.hostname or u.path or u.query or u.fragment or u.username:
    p.error('--app-origin must be an exact HTTPS origin without trailing slash')
if '\n' in a.email or '@' not in a.email: p.error('Invalid email')
root=pathlib.Path(__file__).resolve().parent
secret_dir=root/'secrets'
secret_dir.mkdir(exist_ok=True,mode=0o700)
os.chmod(secret_dir,0o700)
# Never silently regenerate keys for an existing deployment.
for name in ['app.env','migrate.env','db-owner-password','db-app-password']:
    if (secret_dir/name).exists(): p.error('Secrets already exist. Keep them. Change origins manually; do not regenerate media keys.')
owner=secrets.token_urlsafe(36); app=secrets.token_urlsafe(36)
common={
 'NODE_ENV':'production','HOST':'0.0.0.0','PORT':'5000','TZ':'Europe/Kyiv',
 'JWT_ACCESS_SECRET':secrets.token_urlsafe(64),
 'MEDIA_ENCRYPTION_KEY':base64.b64encode(secrets.token_bytes(32)).decode(),
 'APP_ORIGINS':a.app_origin,'TRUST_PROXY':'172.30.18.2',
 'ALLOW_PUBLIC_REGISTRATION':'true','ALLOW_LEGACY_MEDIA':'true','LOG_LEVEL':'info',
}
def write(name,text):
    path=secret_dir/name
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write(text)
write('db-owner-password',owner+'\n');write('db-app-password',app+'\n')
# Only the private parent directory is searchable on the host. PostgreSQL must read mounted files.
os.chmod(secret_dir/'db-owner-password',0o444);os.chmod(secret_dir/'db-app-password',0o444)
for name,user,pw in [('app.env','dorsum_app',app),('migrate.env','dorsum_owner',owner)]:
    env={**common,'DATABASE_URL':f'postgresql://{user}:{pw}@db:5432/dorsum?schema=public&connection_limit=5&pool_timeout=20'}
    write(name,'\n'.join(f'{k}={v}' for k,v in env.items())+'\n')
(root/'.env').write_text(f'API_DOMAIN={a.api_domain}\nACME_EMAIL={a.email}\nRELEASE_TAG=2.1.0\n')
client=root.parents[1]/'client'
config=json.loads((client/'vercel.json').read_text())
config['rewrites'][0]['destination']='https://'+a.api_domain+'/:path*'
(client/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
print('Configuration created. Keep secrets/app.env in a password manager/offline backup. Never commit it.')
print('Vercel: commit client/vercel.json, use VITE_API_URL=/api, Root Directory=client.')
