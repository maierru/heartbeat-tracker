# Heartbeat Worker

Cloudflare Worker backend for heartbeat.work

## Deploy via Dashboard (no CLI needed)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages

2. Create Worker:
   - Click "Create" → "Create Worker"
   - Name it `heartbeat`
   - Click "Deploy"

3. Edit code:
   - Click "Edit code"
   - Delete default code, paste contents of `index.js`
   - Click "Deploy"

4. Add Analytics Engine binding:
   - Go to Worker → Settings → Bindings
   - Add binding → Analytics Engine
   - Variable name: `ANALYTICS`
   - Dataset: `heartbeat` (create new)

5. Add secrets (for reading stats):
   - Go to Worker → Settings → Variables and Secrets
   - Add secret `CF_ACCOUNT_ID` → your account ID (from URL: dash.cloudflare.com/{account_id})
   - Add secret `CF_API_TOKEN` → create token at https://dash.cloudflare.com/profile/api-tokens
     - Permissions: Account Analytics:Read

6. Add custom domain:
   - Go to Worker → Settings → Domains & Routes
   - Add `heartbeat.work`

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/p?a={app}&d={device}&e={env}` | GET | Record ping |
| `/{bundle.id}` | GET | View stats |
| `/{bundle.id}?env=dev` | GET | View dev stats |
| `/` | GET | Home page |

## Test

After deploy, test ping:
```
curl "https://heartbeat.work/p?a=com.test.app&d=abc123&e=dev"
```

View stats:
```
https://heartbeat.work/com.test.app?env=dev
```
