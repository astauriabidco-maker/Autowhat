#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'EOF'
Usage:
  npm run db:restore -- --file backup.dump [options]
  scripts/db-restore.sh --file backup.dump [options]

Restores a PostgreSQL backup into RESTORE_DATABASE_URL.
By default this is a dry-run. Add --apply to execute the restore.

Options:
  --file PATH      Required backup file. Supports .dump/.backup custom dumps and .sql files.
  --apply          Execute the restore. Without this flag, no database writes happen.
  --clean          Drop existing restored objects before recreating them. Only valid with --apply.
  --help           Show this help.

Environment:
  RESTORE_DATABASE_URL  Required target database URL. Prefer a separate restore database.

Safety:
  - This script refuses to write unless --apply is passed.
  - Use RESTORE_DATABASE_URL, not DATABASE_URL, to avoid accidental production restores.
  - Take a fresh backup of the current database before restoring over anything important.
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

APPLY=false
CLEAN=false
RESTORE_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=true
      shift
      ;;
    --clean)
      CLEAN=true
      shift
      ;;
    --file)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Missing value for --file" >&2
        exit 2
      fi
      RESTORE_FILE="$2"
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

if [[ -z "$RESTORE_FILE" ]]; then
  echo "--file is required." >&2
  exit 2
fi

if [[ ! -f "$RESTORE_FILE" ]]; then
  echo "Backup file not found: $RESTORE_FILE" >&2
  exit 2
fi

if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "RESTORE_DATABASE_URL is required." >&2
  exit 2
fi

DISPLAY_RESTORE_DATABASE_URL="$(mask_database_url "$RESTORE_DATABASE_URL")"

case "$RESTORE_FILE" in
  *.sql)
    RESTORE_CMD=(psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=on --file "$RESTORE_FILE")
    REQUIRED_TOOL="psql"
    ;;
  *)
    RESTORE_CMD=(pg_restore --dbname "$RESTORE_DATABASE_URL" --no-owner --no-privileges)
    REQUIRED_TOOL="pg_restore"
    if [[ "$CLEAN" == true ]]; then
      RESTORE_CMD+=(--clean --if-exists)
    fi
    RESTORE_CMD+=("$RESTORE_FILE")
    ;;
esac

if [[ "$CLEAN" == true && "$APPLY" != true ]]; then
  echo "--clean was requested, but restore is still dry-run because --apply is missing."
fi

if [[ "$RESTORE_FILE" == *.sql ]]; then
  printf 'Restore command: psql %q --set ON_ERROR_STOP=on --file %q\n' "$DISPLAY_RESTORE_DATABASE_URL" "$RESTORE_FILE"
else
  printf 'Restore command: pg_restore --dbname %q --no-owner --no-privileges' "$DISPLAY_RESTORE_DATABASE_URL"
  if [[ "$CLEAN" == true ]]; then
    printf ' --clean --if-exists'
  fi
  printf ' %q\n' "$RESTORE_FILE"
fi

if [[ "$APPLY" != true ]]; then
  echo "Dry run only. Re-run with --apply to execute."
  exit 0
fi

if ! command -v "$REQUIRED_TOOL" >/dev/null 2>&1; then
  echo "$REQUIRED_TOOL was not found in PATH." >&2
  exit 127
fi

echo "Applying restore to RESTORE_DATABASE_URL."
"${RESTORE_CMD[@]}"
echo "Restore complete."
