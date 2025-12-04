# 🔧 Configuração de Ambiente - Quick Start

## ✅ Arquivos Criados

```
AupusNexOn/
├── .env                    # Arquivo local (NÃO commitar)
├── .env.development        # Desenvolvimento (localhost) ✅
├── .env.production         # Produção (API pública) ✅
├── .env.example           # Template de exemplo ✅
└── DEPLOY.md              # Guia completo de deploy ✅
```

## 🚀 Como Funciona

### Localmente (Desenvolvimento)
```bash
npm run dev
```
→ Usa `.env.development` → API: `http://localhost:3000/api/v1`

### Build para Produção
```bash
npm run build
```
→ Usa `.env.production` → API: `https://aupus-service-api.aupusenergia.com.br/api/v1`

## 📦 Deploy na Vercel

### Passo 1: Configurar Variáveis de Ambiente na Vercel

Acesse: https://vercel.com/dashboard → Seu Projeto → **Settings** → **Environment Variables**

Adicione para **Production**:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://aupus-service-api.aupusenergia.com.br/api/v1` |
| `VITE_WEBSOCKET_URL` | `https://aupus-service-api.aupusenergia.com.br` |
| `VITE_DEFAULT_DOMAIN` | `https://aupus-service.vercel.app` |
| `VITE_APP_NAME` | `AupusService` |
| `VITE_WEB_VITALS` | `true` |
| `VITE_STANDALONE` | `false` |
| `VITE_S3_URL` | `https://aupusdev.s3.amazonaws.com` |

**Pusher** (copie do seu `.env` local):
- `VITE_PUSHER_APP_ID`
- `VITE_PUSHER_APP_KEY`
- `VITE_PUSHER_APP_SECRET`
- `VITE_PUSHER_HOST`
- `VITE_PUSHER_PORT`
- `VITE_PUSHER_SCHEME`
- `VITE_PUSHER_APP_CLUSTER`

### Passo 2: Fazer Redeploy

Após salvar as variáveis:
1. Vá em **Deployments**
2. Clique em **Redeploy** no último deploy
3. Aguarde o build completar

## ✅ Verificação

Após o deploy:
1. Acesse: https://aupus-service.vercel.app
2. Abra DevTools (F12) → Console
3. Faça login
4. Verifique se as requisições vão para: `https://aupus-service-api.aupusenergia.com.br`

## 🆘 Problemas?

Consulte o guia completo: [DEPLOY.md](./DEPLOY.md)
