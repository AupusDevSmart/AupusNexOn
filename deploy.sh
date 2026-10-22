#!/usr/bin/env bash
# deploy.sh - AupusNexOn (frontend Vite, servido por nginx)
# Uso: ./deploy.sh    (rodar a partir da raiz do projeto)
# Pre-condicoes:
#   - working tree limpo (git status sem mudancas)
#   - branch alinhado com origin/main
#   - nginx serve este projeto a partir de dist/
set -euo pipefail

PROJECT_NAME="AupusNexOn"

step() { printf '\n>>> %s\n' "$*"; }
err()  { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")"

step "Verificando working tree limpo"
if [ -n "$(git status --porcelain)" ]; then
  echo "Mudancas locais nao commitadas detectadas:"
  git status --short
  err "Resolva (commit/stash/discard) antes de fazer deploy. Veja docs/PRE-DEPLOY.md."
fi

step "git pull --ff-only origin main"
git pull --ff-only origin main

step "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

step "Build (vite, outDir=dist.new)"
rm -rf dist.new
pnpm exec vite build --outDir dist.new

step "Manter assets antigos (aba aberta antes do deploy ainda pede os chunks antigos)"
# NEXON-41: sem isso, quem estava com o NexON aberto via "Failed to fetch dynamically
# imported module" ao trocar de pagina ate dar F5. Arquivos tem hash no nome: nao colidem.
if [ -d dist/assets ]; then
  cp -pn dist/assets/* dist.new/assets/ 2>/dev/null || true
  find dist.new/assets -type f -mtime +14 -delete
fi

step "Swap atomico: dist -> dist.previous, dist.new -> dist"
rm -rf dist.previous
[ -d dist ] && mv dist dist.previous || true
mv dist.new dist

step "Estado final"
ls -la dist | head -8

printf '\nDeploy concluido. nginx ja serve a nova versao a partir de dist/.\n'
printf 'Para rollback: rm -rf dist && mv dist.previous dist\n'
