# Guia de Deploy - AupusService Frontend

## 📋 Configuração de Ambientes

Este projeto está configurado para usar **variáveis de ambiente diferentes** em desenvolvimento e produção.

### 🏠 Desenvolvimento (Local)
- **API**: `http://localhost:3000/api/v1`
- **WebSocket**: `http://localhost:3000`
- **Arquivo**: `.env.development`

### 🌐 Produção (Vercel)
- **API**: `https://aupus-service-api.aupusenergia.com.br/api/v1`
- **WebSocket**: `https://aupus-service-api.aupusenergia.com.br`
- **Arquivo**: `.env.production`

## 🚀 Deploy na Vercel

### Opção 1: Usando o Painel da Vercel (Recomendado)

1. Acesse o projeto no painel da Vercel: https://vercel.com/dashboard
2. Vá em **Settings** > **Environment Variables**
3. Adicione as seguintes variáveis para o ambiente **Production**:

```env
VITE_API_URL=https://aupus-service-api.aupusenergia.com.br/api/v1
VITE_APP_NAME=AupusService
VITE_WEBSOCKET_URL=https://aupus-service-api.aupusenergia.com.br
VITE_WEB_VITALS=true
VITE_STANDALONE=false
VITE_DEFAULT_DOMAIN=https://aupus-service.vercel.app
VITE_S3_URL=https://aupusdev.s3.amazonaws.com

# PUSHER (copie os valores do seu .env local)
VITE_PUSHER_APP_ID=1687561
VITE_PUSHER_APP_KEY=96911d5008cfeabb4016
VITE_PUSHER_APP_SECRET=be5cb67410530e8b5ca3
VITE_PUSHER_HOST=be5cb67410530e8b5ca3
VITE_PUSHER_PORT=be5cb67410530e8b5ca3
VITE_PUSHER_SCHEME=be5cb67410530e8b5ca3
VITE_PUSHER_APP_CLUSTER=us2
```

4. Clique em **Save**
5. Vá em **Deployments** e clique em **Redeploy** no último deploy

### Opção 2: Usando a CLI da Vercel

```bash
# Instalar Vercel CLI (se ainda não tiver)
npm i -g vercel

# Fazer login
vercel login

# Deploy do projeto
vercel --prod
```

## 🔍 Verificação

Após o deploy, verifique se está funcionando:

1. Acesse: https://aupus-service.vercel.app
2. Abra o **DevTools** (F12) > **Console**
3. Faça login no sistema
4. Verifique se NÃO há erros de CORS
5. Verifique se as requisições vão para: `https://aupus-service-api.aupusenergia.com.br`

## 🐛 Troubleshooting

### Ainda está acessando localhost:3000?

- Verifique se as variáveis de ambiente foram salvas corretamente na Vercel
- Force um novo deploy: **Deployments** > **Redeploy**
- Limpe o cache do navegador (Ctrl + Shift + Delete)

### Erro de CORS?

A API pública já está configurada com CORS para:
- `https://aupus-service.vercel.app`
- `https://aupus-service-api.aupusenergia.com.br`

Se ainda houver erro, verifique se o domínio do frontend na Vercel está correto.

## 📝 Notas Importantes

- ⚠️ **NUNCA** comite o arquivo `.env` (apenas `.env.example`)
- ⚠️ O arquivo `.env` no root é usado localmente como fallback
- ✅ O Vite automaticamente carrega `.env.development` ou `.env.production`
- ✅ As variáveis `VITE_*` são injetadas no build e ficam visíveis no browser

## 🔐 Segurança

- Variáveis sensíveis (API keys, secrets) devem ser configuradas **apenas no backend**
- Variáveis `VITE_*` são **públicas** e visíveis no código do browser
- Nunca coloque senhas ou tokens privados em variáveis `VITE_*`
