#!/usr/bin/env bash
# Script de atualização: roda no servidor, dentro de ~/index-finance,
# toda vez que houver um novo código em produção.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git pull"
git pull --ff-only

echo "==> npm ci"
npm ci

echo "==> build"
npm run build

echo "==> migrações do banco"
npm run db:deploy

echo "==> reiniciando serviço"
sudo systemctl restart idex-finance

echo "==> pronto"
sudo systemctl status idex-finance --no-pager -l | head -n 10
