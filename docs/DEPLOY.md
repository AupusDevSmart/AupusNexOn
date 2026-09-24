# Deploy — service-nexon (produção)

Manual operacional para deploy e manutenção dos 4 projetos sob `/var/www/service-nexon/` na VPS `srv591267`.

> **Escopo estrito.** Este documento cobre apenas:
> - `aupus-service-api`
> - `aupus-nexon-api`
> - `AupusNexOn` (frontend)
> - `AupusService` (frontend)
>
> **Não tocar** em `/var/www/staging-nexon/`, `/var/www/iot_nexon/`, `/var/www/crm/`, `/var/www/api-bb/`, `/var/www/pdf-generator-service/`. Não mexer em nginx, certbot, postgres@16 nativo, container pgadmin, certificados expirados de `bb.*`.

---

## Sumário

1. [Topologia](#1-topologia)
2. [Arquitetura de dependências](#2-arquitetura-de-dependências)
3. [Deploy rotineiro](#3-deploy-rotineiro)
4. [Mudanças em `api-shared` ou `shared-pages`](#4-mudanças-em-api-shared-ou-shared-pages)
5. [Mudanças de schema do banco](#5-mudanças-de-schema-do-banco)
6. [Mudanças de RBAC (permissions/roles)](#6-mudanças-de-rbac-permissionsroles)
7. [Rollback](#7-rollback)
8. [Pré-requisitos de servidor (one-time)](#8-pré-requisitos-de-servidor-one-time)
9. [Armadilhas conhecidas](#9-armadilhas-conhecidas)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Topologia

### Projetos no escopo

| Projeto             | Path em prod                                 | PM2          | Porta | Domínio público                          |
|---------------------|----------------------------------------------|--------------|-------|------------------------------------------|
| `aupus-service-api` | `/var/www/service-nexon/aupus-service-api`   | id (variável)| 3000  | `aupus-service-api.aupusenergia.com.br`  |
| `aupus-nexon-api`   | `/var/www/service-nexon/aupus-nexon-api`     | id (variável)| 3001  | `aupus-nexon-api.aupusenergia.com.br`    |
| `AupusNexOn`        | `/var/www/service-nexon/AupusNexOn` (`dist/`)| nginx        | -     | `nexon.aupusenergia.com.br`              |
| `AupusService`      | `/var/www/service-nexon/AupusService` (`dist/`)| nginx      | -     | `service.aupusenergia.com.br`            |

PM2 ids podem mudar em re-registros (`pm2 delete <app> && pm2 start ecosystem.config.cjs`). Use o **nome** (`aupus-service-api`, `aupus-nexon-api`) ao invés do id.

### Infraestrutura

- **Postgres da app**: container Docker `aupus-db-local` (`postgres:15-alpine`), `localhost:5433` → container `:5432`. Database: `aupus`. Usado pelos 4 projetos service-nexon **+ /var/www/iot_nexon/** (compartilhado, ver §5).
- **Postgres@16 nativo**: roda em `127.0.0.1:5432`, do CRM legado, **fora do escopo**.
- **Redis**: nativo via systemd em `127.0.0.1:6379` (sem senha em prod atual).
- **MQTT broker**: remoto em `72.60.158.163:1883` (plaintext).
- **Sentry**: DSN único compartilhado pelas 2 APIs (eventos misturados — housekeeping pendente).

### Reverse proxy

`nginx` (config em `/etc/nginx/sites-enabled/`) faz:
- Proxy `aupus-service-api.aupusenergia.com.br` → `localhost:3000`
- Proxy `aupus-nexon-api.aupusenergia.com.br` → `localhost:3001`
- Static `service.aupusenergia.com.br` → `/var/www/service-nexon/AupusService/dist/`
- Static `nexon.aupusenergia.com.br` → `/var/www/service-nexon/AupusNexOn/dist/`
- HTTPS via certbot (Let's Encrypt) com renovação automática.

---

## 2. Arquitetura de dependências

### Repositórios envolvidos

```
github.com/AupusDevSmart/
├── api-shared        ← biblioteca NestJS (modules, PrismaService, schema único)
├── shared-pages      ← biblioteca React (BaseTable, BaseModal, etc.)
├── aupus-service-api ← backend (consome api-shared)
├── aupus-nexon-api   ← backend (consome api-shared)
├── AupusService      ← frontend (consome shared-pages)
└── AupusNexOn        ← frontend (consome shared-pages)
```

### Como os shared packages chegam em prod

Em `package.json` dos 4 consumidores, a referência é uma tag GitHub:

```json
"@aupus/api-shared": "git+https://github.com/AupusDevSmart/api-shared.git#vX.Y.Z"
"@aupus/shared-pages": "git+https://github.com/AupusDevSmart/shared-pages.git#vX.Y.Z"
```

`pnpm install` baixa o tarball da tag. **Não roda `pnpm build` no pacote** — por isso `dist/` precisa estar tracked no git desses pacotes (ver §9).

**Implicação:** mudança em `api-shared`/`shared-pages` só chega em prod se: (a) bumpar versão + criar tag, (b) atualizar `package.json` dos consumidores apontando pra nova tag, (c) `pnpm install` regenerar lockfile, (d) commit/push consumidores, (e) deploy. Ver §4.

### `api-shared` é a única fonte do schema do banco

A partir de `api-shared@v0.3.0`:
- `api-shared/prisma/schema.prisma` é canônico.
- `api-shared/src/index.ts` faz `export * from '@prisma/client'` — re-exporta tipos (`Prisma`, enums) e `PrismaClient`.
- `aupus-service-api` e `aupus-nexon-api` **não têm `prisma/`** próprio. Importam tudo via `from '@aupus/api-shared'`:

```ts
import {
  PrismaService,        // injection do NestJS
  Prisma,               // namespace de tipos
  StatusAnomalia,       // enum gerado pelo schema
  PrismaClient,         // se precisar instanciar manualmente em scripts
} from '@aupus/api-shared';
```

- `deploy.sh` dos backends **não roda `pnpm prisma generate`**, mas o generate é
  **OBRIGATÓRIO** manualmente após todo `pnpm install` que troque a versão do
  api-shared (confirmado em 2026-08-05/06 no deploy do PR6: o pacote traz só o
  `schema.prisma`, **não** traz client gerado, e o pnpm 10 ignora o postinstall
  do `@prisma/client`). Ordem correta nos backends:

  ```bash
  pnpm install --frozen-lockfile
  pnpm exec prisma generate --schema=node_modules/@aupus/api-shared/prisma/schema.prisma
  pnpm run build
  pm2 reload ecosystem.config.cjs --update-env
  ```

  Sintoma de client stale: dezenas de erros TS2339/TS2353 no build citando
  campos que não existem mais (ou que faltam) em `PrismaService`. Em mudança de
  schema, gerar **depois** de migrar o banco, nunca antes.

### Tags atuais (atualizar quando fizer bump)

- `api-shared@v0.3.0` (commit `85b552c`) — re-export `@prisma/client`
- `shared-pages@v0.2.0` (commit `b61e076`) — `EquipamentoAvatar`, `lib/uploads`

---

## 3. Deploy rotineiro

### Pré-condições antes de fazer deploy

1. Working tree do repo (em prod) está limpo. `deploy.sh` aborta se não estiver.
2. Branch `main` local está alinhado com `origin/main` (sem commits pendentes).
3. `.env` em prod já populado (vive no servidor, gitignored).
4. PM2 está rodando o app via `ecosystem.config.cjs` (não ad-hoc).

### Deploy de um único projeto

```bash
ssh root@srv591267
cd /var/www/service-nexon/<projeto>
./deploy.sh
```

O script faz, em ordem:
1. Verifica working tree limpo (aborta se sujo)
2. `git pull --ff-only origin main`
3. `pnpm install --frozen-lockfile`
4. **Backends**: snapshot `dist/` em `dist.previous/`, `pnpm run build`, `pm2 reload ecosystem.config.cjs --update-env`
5. **Frontends**: `pnpm exec vite build --outDir dist.new`, swap atômico `dist → dist.previous`, `dist.new → dist`. nginx pega imediatamente.

Ao final, imprime instrução de rollback.

### Deploy dos 4 projetos (ordem importa)

**Backends primeiro**, depois frontends. Razão: se um endpoint novo aparece em backend e frontend novo já está esperando, e backend ainda está antigo, o frontend dá erro. Sequência inversa quebra.

```bash
cd /var/www/service-nexon/aupus-service-api && ./deploy.sh
cd /var/www/service-nexon/aupus-nexon-api   && ./deploy.sh
cd /var/www/service-nexon/AupusNexOn        && ./deploy.sh
cd /var/www/service-nexon/AupusService      && ./deploy.sh
```

### Sanity checks pós-deploy

```bash
# APIs respondendo (esperado: 401 Unauthorized — significa "rodando + auth ativo")
curl -fsS -o /dev/null -w "%{http_code}\n" https://aupus-service-api.aupusenergia.com.br/api/v1/test-db
curl -fsS -o /dev/null -w "%{http_code}\n" https://aupus-nexon-api.aupusenergia.com.br/api/v1/test-db

# Frontends carregando (esperado: 200)
curl -fsSI https://service.aupusenergia.com.br | head -1
curl -fsSI https://nexon.aupusenergia.com.br   | head -1

# PM2 saudável
pm2 list
pm2 logs aupus-service-api --lines 30 --nostream
pm2 logs aupus-nexon-api   --lines 30 --nostream
```

Esperado nos logs: `[PrismaService] Conectado ao banco de dados com sucesso`, `Nest application successfully started`, sem stack traces recentes.

---

## 4. Mudanças em `api-shared` ou `shared-pages`

Toda mudança nestes pacotes precisa de **bump de tag** pra chegar em prod. Sem isso, `pnpm install` segue puxando a tag antiga.

### 4.1 Workflow para `api-shared`

```bash
# (1) Editar código
cd c:/Users/Public/aupus-service/api-shared
# ... edits em src/ ou prisma/schema.prisma ...

# (2) Build (gera dist/ que vai pro git)
pnpm build

# (3) Bump em package.json (semver)
# 0.3.0 → 0.4.0 (feature) ou 0.3.1 (patch/fix)

# (4) Commit, tag, push
git add -A
git commit -m "feat: <descricao>"
git tag v0.4.0
git push origin main
git push origin v0.4.0

# (5) Atualizar consumidores (aupus-service-api e aupus-nexon-api)
cd c:/Users/Public/aupus-service/aupus-service-api
# Editar package.json: trocar #v0.3.0 → #v0.4.0
pnpm install   # regenera pnpm-lock.yaml apontando pro novo SHA
git add package.json pnpm-lock.yaml
git commit -m "chore: bump @aupus/api-shared para v0.4.0"
git push origin main

# Repetir pra aupus-nexon-api

# (6) Deploy em prod (§3)
```

### 4.2 Workflow para `shared-pages`

Idêntico, com 2 diferenças:
- Consumidores são `AupusNexOn` e `AupusService` (frontends).
- O `dist/` do `shared-pages` precisa estar **tracked** (não em `.gitignore`) — pnpm não roda build em pacotes baixados de Git URL.

### 4.3 Atalho: bump simultâneo

Se a mudança em `api-shared` é coordenada com mudança em `aupus-service-api` (ex: novo módulo no shared usado pelo backend), bumpe ambos no mesmo PR/branch para evitar momento intermediário onde o consumer está desalinhado.

---

## 5. Mudanças de schema do banco

> **Cuidado central:** o postgres compartilha tabelas com `/var/www/iot_nexon/`. As tabelas `iot_componentes`, `iot_conexoes`, `iot_device_modelos`, `iot_device_tipos`, `iot_dispositivos_online`, `iot_firmwares`, `iot_projetos` **não estão no schema do api-shared** mas **existem no banco** e são usadas pelos apps PM2 `iot-firmware-gen` e `iot-firmware-compiler`.

### 5.1 NUNCA fazer

```bash
# ☠️ NUNCA RODAR EM PROD - vai propor DROP nas iot_* e destruir o sistema IoT
pnpm prisma db push
pnpm prisma migrate deploy
pnpm prisma migrate dev
ts-node scripts/db/seed-permissions.ts   # destrutivo: apaga 107 model_has_permissions reais
```

### 5.2 Workflow correto: `migrate diff` + apply seletivo

**Passo 1: editar o schema canônico em api-shared**

```bash
cd c:/Users/Public/aupus-service/api-shared
# Editar prisma/schema.prisma
pnpm build
```

Bump tag (§4.1). Atualiza consumers. Push. Mas **ainda não rode `./deploy.sh` em prod** — o banco precisa receber a mudança DDL antes (senão o Prisma Client vai pedir colunas que não existem → 500).

**Passo 2: gerar SQL surgical em prod**

```bash
ssh root@srv591267
cd /var/www/service-nexon/aupus-service-api
git pull --ff-only origin main   # traz o novo schema do api-shared via pnpm install
pnpm install --frozen-lockfile

# Gera o diff entre DB atual e schema novo:
pnpm prisma migrate diff \
  --from-schema-datasource node_modules/@aupus/api-shared/prisma/schema.prisma \
  --to-schema-datamodel    node_modules/@aupus/api-shared/prisma/schema.prisma \
  --script > /tmp/diff.sql
```

> Se prisma CLI não estiver instalado (a gente removeu da package.json), use `pnpm dlx prisma@latest migrate diff ...`.

**Passo 3: REVISAR o diff e filtrar DROPs perigosos**

```bash
cat /tmp/diff.sql
# Procura por DROP TABLE, DROP CONSTRAINT, ALTER COLUMN ... NOT NULL, ALTER COLUMN TYPE
# Se aparecerem DROPs em iot_*, MIGRATION_CATEGORIAS ou tabelas legacy, SAIR DELES.

grep -vE '^DROP (TABLE|CONSTRAINT)|^ALTER TABLE.*DROP CONSTRAINT' /tmp/diff.sql > /tmp/safe.sql
diff /tmp/diff.sql /tmp/safe.sql   # confirma o que foi removido
cat /tmp/safe.sql                  # último review
```

**Passo 4: backup defensivo**

```bash
DB_URL_LIBPQ=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed -E 's/\?.*$//')
BACKUP_DIR=/root/db-backup-$(date +%Y%m%d-%H%M)
mkdir -p $BACKUP_DIR && cd $BACKUP_DIR
pg_dump "$DB_URL_LIBPQ" --schema-only > backup-schema.sql
pg_dump "$DB_URL_LIBPQ" -t <tabela_afetada_1> -t <tabela_afetada_2> --data-only --column-inserts > backup-data.sql
ls -lh
```

**Passo 5: aplicar em transação**

```bash
psql "$DB_URL_LIBPQ" -v ON_ERROR_STOP=on --single-transaction -f /tmp/safe.sql
# Se falhar em qualquer comando → rollback automático (--single-transaction)
```

**Passo 6: deploy normal dos backends**

```bash
cd /var/www/service-nexon/aupus-service-api && ./deploy.sh
cd /var/www/service-nexon/aupus-nexon-api   && ./deploy.sh
```

### 5.3 Estado conhecido do schema (atualizar conforme evolui)

- `prisma/migrations/` foi removido de `api-shared` em algum ponto — não rodar `migrate deploy`.
- Tabelas `iot_*` só existem no banco, não no schema. Housekeeping pendente: adicionar models `iot_*` em `api-shared/prisma/schema.prisma` pra fechar a armadilha.

---

## 6. Mudanças de RBAC (permissions/roles)

### 6.1 Convenção atual

- **Permissions** em formato `recurso.acao` (ex: `unidades.view`, `equipamentos.manage`).
- **Roles** definidas em `api-shared` (ou no `permissions-structure.ts` movido para `scripts/db/`): `operador`, `proprietario`, `analista`, `gerente`, `admin`, `super_admin`.
- **Convivência com PascalCase legado**: `permissions` em prod tem ~50 entradas com `guard='api'` (PascalCase como `AreaDoProprietario`, `UnidadesConsumidoras`) **mais** ~78 com `guard='web'` (dot-notation). As novas entram com `guard='web'`. Roles ficam em `guard='api'`.
- **Runtime não filtra por guard.** `getUserPermissions` em api-shared faz Prisma query sem `WHERE guard_name = X` — junta tudo que está em `role_has_permissions` para a role do usuário.

### 6.2 NUNCA fazer

```bash
# ☠️ Destrutivo - TRUNCATE em model_has_permissions (107 grants reais perdidos)
ts-node scripts/db/seed-permissions.ts
```

Os 107 grants em `model_has_permissions` incluem:
- Arthur Faggin (10 dot-notation, dev usando o sistema novo)
- Giordanna QA (28 mistos)
- 2 organizações (18 PascalCase cada)
- Outros users com grants administrativos pontuais

### 6.3 Workflow para adicionar perms a roles existentes

Padrão **idempotente** com `ON CONFLICT DO NOTHING`:

```sql
BEGIN;

-- Cria permissions novas se não existirem (guard='web' por convenção):
WITH desired_perms (name, display_name, description) AS (VALUES
  ('nova_perm.view', 'Ver Nova', 'descrição')
  -- ... mais
)
INSERT INTO permissions (name, guard_name, display_name, description, created_at, updated_at)
SELECT dp.name, 'web', dp.display_name, dp.description, NOW(), NOW()
FROM desired_perms dp
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = dp.name);

-- Mapeia em role_has_permissions:
CREATE TEMPORARY TABLE desired_mappings (role_name text, permission_name text);
INSERT INTO desired_mappings VALUES
  ('proprietario', 'nova_perm.view'),
  ('analista',     'nova_perm.view');
  -- ... mais

INSERT INTO role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM desired_mappings d
JOIN roles r ON r.name = d.role_name
JOIN permissions p ON p.name = d.permission_name
ON CONFLICT (permission_id, role_id) DO NOTHING;

COMMIT;
```

Sempre rodar **com `ROLLBACK` no final primeiro** pra preview, depois trocar pra `COMMIT` no segundo run.

### 6.4 Após mudar `role_has_permissions`

Usuários com sessão ativa precisam de **logout + login** para o JWT pegar as novas perms. Token JWT expira em 1h por default; quem ficar logado eventualmente recebe novo token via refresh.

### 6.5 Frontends com gates desabilitados

Hoje (`AupusNexOn`): `FeatureWrapper.tsx` e `useFilteredNavigationLinks.ts` têm os checks **comentados** — todo menu/rota aparece pra todo mundo. O 403 vem só do backend.

Hoje (`AupusService`): gates **ativados** com `featureKey` em dot-notation. Sidebar filtra por `acessivel.includes(featureKey)`.

Cada domínio tem `localStorage` independente. Após mudança de RBAC, usuário precisa logout+login **em cada domínio** que usar.

---

## 7. Rollback

### Backend

```bash
ssh root@srv591267
cd /var/www/service-nexon/<projeto>
rm -rf dist
mv dist.previous dist
pm2 reload ecosystem.config.cjs
```

### Frontend

```bash
cd /var/www/service-nexon/<projeto>
rm -rf dist
mv dist.previous dist
# nginx pega imediatamente, sem reload
```

### Banco (DDL surgery)

Backup em `/root/db-backup-YYYYMMDD-HHMM/`:
- `backup-schema.sql` — DDL completa (re-criar tabela individualmente se preciso)
- `backup-data.sql` — dados das tabelas afetadas

Restore parcial (exemplo):

```bash
psql "$DB_URL_LIBPQ" -c "DROP TABLE planta_operadores CASCADE"  # cuidado
# Para restaurar dados de backup específico:
psql "$DB_URL_LIBPQ" -f /root/db-backup-XXX/backup-data.sql
```

### Git rollback (último recurso)

Se o `git pull` puxou commit ruim:

```bash
git log --oneline -5     # achar o SHA seguro anterior
git reset --hard <SHA>   # ⚠️ destrutivo — só após backup local de qualquer mudança
./deploy.sh
```

---

## 8. Pré-requisitos de servidor (one-time)

Estes passos foram executados no cutover de 2026-04-28. Documentar caso precise refazer (servidor novo, restore de catástrofe).

### 8.1 PM2

```bash
# Por projeto (do diretório do projeto):
pm2 start ecosystem.config.cjs
pm2 save                    # persiste estado para sobreviver reboots
pm2 startup                 # gera systemd unit (rodar uma vez no servidor)
```

### 8.2 `.env` dos backends

Cada backend tem `.env` em `<projeto>/.env`, **gitignored**, mantido no servidor. Chaves obrigatórias (ver `.env.example` para descrição completa):

```
DATABASE_URL=postgresql://postgres:<senha>@localhost:5433/aupus?schema=public&...
NODE_ENV=production
PORT=3000  # ou 3001 para nexon-api
LOG_LEVEL=info
CORS_ORIGIN=https://service.aupusenergia.com.br,https://nexon.aupusenergia.com.br  # service-api
# (nexon-api: CORS_ORIGIN=https://nexon.aupusenergia.com.br)
JWT_SECRET=<secret>
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d
MQTT_HOST=72.60.158.163
MQTT_PORT=1883
MQTT_USERNAME=root
MQTT_PASSWORD=<senha>
MQTT_MODE=production            # apenas UM dos 2 backends pode estar em production!
MQTT_LOG_LEVEL=normal
INSTANCE_ID=production-server
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply-aupus@aupusenergia.com.br
SMTP_PASS=<senha>
SMTP_FROM_NAME=Aupus
SMTP_FROM_EMAIL=no-reply-aupus@aupusenergia.com.br
FRONTEND_URL=https://service.aupusenergia.com.br
SENTRY_DSN=https://...
```

Permissão: `chmod 600 .env`.

### 8.3 `git config core.fileMode false`

Em cada um dos 4 repos, no servidor:

```bash
git config core.fileMode false
```

Sem isso, `chmod +x deploy.sh` aparece como mudança no working tree e bloqueia `./deploy.sh` em runs subsequentes (foram pegos no cutover Linux↔Windows).

### 8.4 nginx

Já configurado. Locais dos vhosts:
- `/etc/nginx/sites-enabled/aupus-service-api` (proxy 3000)
- `/etc/nginx/sites-enabled/aupus-nexon-api` (proxy 3001)
- `/etc/nginx/sites-enabled/service.aupusenergia.com.br` (static `/var/www/service-nexon/AupusService/dist`)
- `/etc/nginx/sites-enabled/nexon.aupusenergia.com.br` (static `/var/www/service-nexon/AupusNexOn/dist`)

`certbot` renova certs automaticamente via timer.

---

## 9. Armadilhas conhecidas

### `prisma generate` manual após bump do api-shared
O pacote não traz client gerado e o pnpm 10 ignora o postinstall do
`@prisma/client`. Sem o generate manual (§4), o build falha com TS2339/TS2353
em massa — pegou o deploy do PR6 em 2026-08-05 (client do store estava de
19/06). Comando e ordem corretos: ver §4.

### Não usar `sed` em arquivos versionados durante deploy
Os scripts antigos faziam `sed -i` em `main.ts`, `.env`, `tsconfig.json` para "ajustar" pra prod. Próximo `git pull` revertia, deploy rodava `sed` de novo. Loop frágil. Hoje:
- CORS vem de `CORS_ORIGIN` no `.env`
- URLs dos frontends vêm de `.env.production` (Vite carrega automaticamente em mode=production)

### Não editar `package.json` no servidor
Anteriormente, alguém trocava `file:../api-shared` por `git+https://...` no servidor manualmente. Causava conflito em `git pull` e dor crônica. Resolvido: hoje `package.json` versionado já tem `git+https://...#vX.Y.Z`. **Servidor nunca edita `package.json`.**

### Não rodar `prisma migrate deploy`
A pasta `prisma/migrations/` está corrompida (mistura de subpastas válidas + SQLs avulsos na raiz, nunca um estado de baseline limpo). Schema é gerenciado via SQL surgical (§5).

### Não rodar `prisma db push` em prod
Apaga as 7 tabelas `iot_*` do `/var/www/iot_nexon/` (compartilham o mesmo banco). Sempre usar `migrate diff --script` e filtrar DROPs.

### Apenas UMA instância com `MQTT_MODE=production`
PM2 está em `exec_mode: fork, instances: 1`. Não mudar para cluster — duplicaria subscriptions e gravaria duplicado no banco.

### `dist.previous/` e `dist.new/` ficam no `.gitignore`
Criados pelo `deploy.sh` para rollback / atomic swap. Já cobertos pelos `.gitignore` dos 4 projetos. Não comitar.

### Em pnpm, é `pnpm install`, não `npm install`
Lockfile é `pnpm-lock.yaml`. Misturar `npm install` gera `package-lock.json` divergente.

### `package-lock.json` esporádico
Se aparecer um na raiz de algum projeto pnpm, é resíduo de instalação acidental com npm. Apagar.

### Strip query params do Prisma na URL antes de usar com `pg_dump`/`psql`
`libpq` não aceita `connection_limit`, `pool_timeout`, `schema=public`, etc. Strip:

```bash
DB_URL_LIBPQ=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed -E 's/\?.*$//')
```

### Sentry DSN compartilhado
As 2 APIs mandam pro mesmo project Sentry. Eventos misturados. Quando voltar a usar Sentry de fato, criar projects separados.

### `_has_permissions` PascalCase legacy continua existindo
Não foram removidas porque 2 organizações em prod ainda usam (`AreaDoProprietario` etc.) e o frontend AupusService tem código que depende. Conviver, não tentar limpar sem mapear o impacto.

### Cada domínio frontend tem `localStorage` independente
`service.aupusenergia.com.br` ≠ `nexon.aupusenergia.com.br` para o navegador. Logout em um não desloga no outro. Após mudança de RBAC ou JWT structure, **logout+login em cada domínio**.

### Frontends consomem `shared-pages` via tag GitHub sem build
`shared-pages/dist/` precisa estar tracked no git. Ignorar no `.gitignore` quebra os consumers (descoberto durante o cutover).

### `chmod +x` em deploy.sh do dev Windows
Git no Windows não rastreia o bit executável. `chmod +x` no Linux aparece como modificação. Mitigado por: (a) `git config core.fileMode false` em prod, (b) `git update-index --chmod=+x deploy.sh` no dev (já feito).

### Após mudança em `role_has_permissions`, usuário precisa logout+login
JWT carrega snapshot das perms no momento do login. Tokens válidos não pegam novas perms até refresh / re-login.

---

## 10. Troubleshooting

### `./deploy.sh` aborta com "Mudancas locais nao commitadas detectadas"

Working tree não está limpo. Ver o que está sujo:

```bash
git status --short
```

Se for `dist.previous/` ou similar criado pelo deploy: já é coberto pelo `.gitignore` (deve sumir após `git pull` se o `.gitignore` em `main` está atualizado).

Se forem mudanças reais (alguém editou no servidor), preserve com stash:

```bash
git stash --include-untracked -m "manual changes $(date +%F)"
git pull --ff-only origin main
./deploy.sh
git stash list   # backup fica preservado
```

### Build falha com "Cannot find module '@aupus/api-shared'" ou similar

A tag referenciada em `package.json` não existe. Verificar:

```bash
git ls-remote --tags https://github.com/AupusDevSmart/api-shared.git | grep <tag>
```

Se não existir, refazer o bump do api-shared (§4.1).

### 500 em endpoint com erro "column X does not exist"

Schema drift: Prisma Client espera coluna que o banco não tem. Apareceu hoje com `equipamentos.foto_url`. Solução em §5.

```bash
# Identificar o que falta:
pnpm dlx prisma@latest migrate diff \
  --from-schema-datasource node_modules/@aupus/api-shared/prisma/schema.prisma \
  --to-schema-datamodel    node_modules/@aupus/api-shared/prisma/schema.prisma \
  --script | grep -E '^(ALTER|CREATE)' | grep -v DROP
```

### 403 em endpoint que precisa de permission

JWT do usuário não tem a permission requerida. Diagnosticar:

```bash
# Pegar JWT do navegador (DevTools > Application > localStorage > authToken)
JWT="eyJ..."
echo "$JWT" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | jq .
# Olhar permissions[] e role
```

Conferir se a role tem a perm em `role_has_permissions`:

```sql
SELECT p.name FROM role_has_permissions rhp
JOIN permissions p ON rhp.permission_id = p.id
JOIN roles r ON r.id = rhp.role_id
WHERE r.name = '<role_do_usuario>';
```

Se a perm não está mapeada, adicionar via §6.3. Após apply, **logout+login**.

### Sidebar vazia no AupusService

`localStorage.user-storage.state.user.all_permissions` está stale ou em formato antigo. Solução:

1. Logout pelo botão da UI
2. Se UI não permite (sidebar quebrada), no DevTools console:
   ```js
   localStorage.clear(); location.reload();
   ```
3. Login novamente

### `pnpm install` muito lento

Quando `pnpm` baixa um pacote git+https novo, ele clona o repo. Primeira instalação leva ~30s-1min. Subsequentes (mesmo SHA) usam cache.

### `pg_dump` falha com "invalid URI query parameter"

`libpq` não aceita os query params do Prisma. Strip antes (§5.2 ou §9).

### Logs muito grandes (>1GB em `logs/`)

Truncar manualmente:

```bash
> /var/www/service-nexon/<projeto>/logs/out.log
> /var/www/service-nexon/<projeto>/logs/error.log
pm2 reloadLogs
```

Configurar logrotate no futuro como housekeeping.

### Frontend mostra "Network Error" ou CORS bloqueia

Conferir `CORS_ORIGIN` no `.env` do backend correspondente:

```bash
grep CORS_ORIGIN /var/www/service-nexon/aupus-service-api/.env
grep CORS_ORIGIN /var/www/service-nexon/aupus-nexon-api/.env
```

Se faltar a origem do frontend, adicionar e:

```bash
pm2 reload aupus-service-api --update-env  # ou aupus-nexon-api
```

### Restart count (↺) crescendo no PM2

`pm2 list` mostra `↺=N` por app. Reload normal incrementa por +1. Se subir muito (>5 entre deploys), o app está crashando. Investigar:

```bash
pm2 logs <app> --err --lines 100 --nostream
```

Comum: erro de conexão com banco/redis/MQTT no boot. Ver `.env`.

### Container postgres parou

```bash
docker ps -a | grep aupus-db-local
docker start aupus-db-local
docker logs aupus-db-local --tail 50
```

---

## Apêndice A: comandos prontos para emergência

```bash
# Ver tudo do service-nexon de uma vez
ssh root@srv591267 'pm2 list && df -h / && du -sh /var/www/service-nexon/*/logs 2>/dev/null'

# Tail de logs simultâneos
pm2 logs aupus-service-api aupus-nexon-api --lines 50

# Forçar pickup de novo .env sem rebuild
pm2 reload <app> --update-env

# Reverter pra dist anterior (último deploy)
cd /var/www/service-nexon/<projeto>
rm -rf dist && mv dist.previous dist
[ -f ecosystem.config.cjs ] && pm2 reload ecosystem.config.cjs   # backend

# Health check rápido dos 4 domínios
for d in aupus-service-api aupus-nexon-api service nexon; do
  echo -n "$d: "
  curl -fsS -o /dev/null -w "%{http_code} (%{time_total}s)\n" https://$d.aupusenergia.com.br/api/v1/test-db 2>/dev/null \
    || curl -fsS -o /dev/null -w "%{http_code} (%{time_total}s)\n" https://$d.aupusenergia.com.br
done
```

## Apêndice B: histórico de deploys importantes

| Data       | O que mudou                                                                                          |
|------------|------------------------------------------------------------------------------------------------------|
| 2026-04-27 | Padronização de `.env`, CORS via env var, `ecosystem.config.cjs` versionado, `deploy.sh` unificado   |
| 2026-04-28 | Cutover api-shared@v0.2.0 + shared-pages@v0.2.0 + schema fix (foto_url, planta_operadores) + RBAC fix (role analista, 18 perms, 117 mappings) |
| 2026-04-28 | api-shared@v0.3.0: re-export `@prisma/client`. Backends consumidores deixam de ter `prisma/` próprio |
| 2026-05-21 | `seed-iot-catalog.ts --force`: ressincronizou `iot_device_modelos` do `migration_iot_tables.sql` (versão antiga, 27/04) com o `iot-device-catalog.v2.js` atual. 3 modelos corrigidos: M-160 (regs 100→37, FLOAT→U16, +tp_tc), PD666 (regs 0→0x2006, +tp_tc), URP6000. Backup em `/root/db-backup-iot-catalog-20260521-154056/`. TONs em campo com esses modelos precisam de novo OTA pra pegar mapeamento corrigido. |
| 2026-05-27 | **AupusNexOn frontend deploy** (commit `3096d91` em `main`, **não pushed pra origin** — token GitHub expirado, push fica pendente). Mudanças: (1) `iot-firmware-generator.v2.js` — 4 melhorias RS485 contra `rc=0xE0` (drain RX em `_select`, `flush()` em `_preTx`, retry diferenciado para `0xE0`, delays entre blocos 40→80ms / DE-RE 500→1000µs). (2) `iot-device-catalog.v2.js` — cadastra `sungrow-sg333hx` em paridade com DB (já inserido em `iot_device_modelos` desde sessão anterior). (3) `iot-diagram.tsx` — bump `IOT_SCRIPTS_VERSION` para `20260527-rs485fix` (força reload dos `.v2.js` no browser). Plano + baseline + diff em `docs/IOT-RS485-MELHORIAS.md`. TONs em campo precisam de regenerar firmware + reflash (USB ou OTA) pra herdar as melhorias RS485 — não automático. |

> **Pendência operacional 2026-05-27**: token GitHub `ghp_HNk6...` rejeitou push do commit `3096d91`. Commit existe localmente em prod (`/var/www/service-nexon/AupusNexOn`) mas não está em `origin/main`. Quando o token for renovado: `git remote set-url origin https://NOVO_TOKEN@github.com/AupusDevSmart/AupusNexOn.git && git push origin main`.

Atualizar este apêndice com cada mudança estrutural.
