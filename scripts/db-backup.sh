#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'EOF'
Usage:
  npm run db:backup -- [options]
  scripts/db-backup.sh [options]

Creates a PostgreSQL custom-format dump with pg_dump.

Options:
  --dry-run         Print the pg_dump command without creating a file.
  --file PATH      Output dump path. Defaults to BACKUP_DIR/autowhat-<timestamp>.dump.
  --help           Show this help.

Environment:
  DATABASE_URL          Required unless BACKUP_DATABASE_URL is set.
  BACKUP_DATABASE_URL   Optional override for the database to dump.
  BACKUP_DIR            Optional output directory. Defaults to ./backups.

Notes:
  - The default format is pg_dump custom format, suitable for pg_restore.
  - Do not store production dumps permanently on the app server.
EOF
}

mask_database_url() {
  local url="$1"
  if [[ "$url" == *"://"* && "$url" == *"@"* ]]; then
    local scheme="${url%%://*}"
    local rest="${url#*://}"
    local host_part="${rest#*@}"
    printf '%s://***:***@%s' "$scheme" "$host_part"
  else
    printf '%s' "$url"
  fi
}

DRY_RUN=false
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --file)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Missing value for --file" >&2
        exit 2
      fi
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_help >&2
      exit 2
      ;;
  esac
done

DB_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
DISPLAY_DB_URL="$(mask_database_url "$DB_URL")"
if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL or BACKUP_DATABASE_URL is required." >&2
  exit 2
fi

if [[ -z "$OUTPUT_FILE" ]]; then
  BACKUP_DIR="${BACKUP_DIR:-backups}"
  TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  OUTPUT_FILE="${BACKUP_DIR%/}/autowhat-${TIMESTAMP}.dump"
fi

PG_DUMP_CMD=(pg_dump "$DB_URL" --format=custom --no-owner --no-privileges --file "$OUTPUT_FILE")

echo "Backup target: $OUTPUT_FILE"
if [[ "$DRY_RUN" == true ]]; then
  printf 'Dry run command: pg_dump %q --format=custom --no-owner --no-privileges --file %q\n' "$DISPLAY_DB_URL" "$OUTPUT_FILE"
  exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump was not found in PATH." >&2
  exit 127
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
"${PG_DUMP_CMD[@]}"

echo "Backup complete: $OUTPUT_FILE"
