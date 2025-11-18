#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
SCHEMA_FILE="config/database-schema.sql"

usage() {
  cat <<USAGE
Usage: DB_HOST=host DB_USER=user DB_PASSWORD=pass $0

Applique le schéma faces_db depuis $SCHEMA_FILE.
Variables :
  DB_HOST (défaut: localhost)
  DB_PORT (défaut: 3306)
  DB_USER (défaut: root)
  DB_PASSWORD (défaut: vide)
USAGE
}

if [[ "${1:-}" == "--help" ]]; then
  usage; exit 0
fi

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Schéma introuvable: $SCHEMA_FILE" >&2
  exit 1
fi

MYSQL_OPTS=("-h" "$DB_HOST" "-P" "$DB_PORT" "-u" "$DB_USER" "--protocol" "TCP")
if [[ -n "$DB_PASSWORD" ]]; then
  MYSQL_OPTS+=("-p$DB_PASSWORD")
fi

echo "➡️  Application du schéma sur $DB_HOST:$DB_PORT"
mysql "${MYSQL_OPTS[@]}" < "$SCHEMA_FILE"
echo "✅ Base faces_db prête"
