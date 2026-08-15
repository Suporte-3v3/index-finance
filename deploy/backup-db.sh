#!/usr/bin/env bash
# Backup diário do Postgres rodando em Docker. Pensado pra rodar via cron
# no usuário ubuntu, no servidor de produção.
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
source .env.local
set +a

BACKUP_DIR="$HOME/backups/postgres"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/idex-finance-$TIMESTAMP.sql.gz"

docker exec idex-finance-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"

# Mantém só os últimos 7 dias de backup.
find "$BACKUP_DIR" -name "idex-finance-*.sql.gz" -mtime +7 -delete

echo "Backup salvo em $FILE"
