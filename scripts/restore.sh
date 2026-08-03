#!/bin/sh
# Restore a DentalERP backup taken by scripts/backup.sh.
#
#   ./scripts/restore.sh ./backups/20260803T101500Z          # dry run
#   ./scripts/restore.sh ./backups/20260803T101500Z --yes    # actually do it
#
# This overwrites the live database and the uploads volume. Without --yes it
# describes what it would do and stops, because the moment you actually need
# this you will be tired and in a hurry.

set -eu

PROJECT="dental-erp"
SRC="${1:-}"
CONFIRM="${2:-}"

if [ -z "$SRC" ]; then
  echo "Usage: $0 <backup-directory> [--yes]" >&2
  exit 1
fi

if [ ! -f "$SRC/database.sql.gz" ]; then
  echo "No database.sql.gz in $SRC — is that a backup directory?" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "No .env here. Run this from the directory holding docker-compose.yml." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
. ./.env
set +a

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set in .env}"
MYSQL_DATABASE="${MYSQL_DATABASE:-dental_erp}"

echo "Backup:   $SRC"
[ -f "$SRC/manifest.txt" ] && sed 's/^/  /' "$SRC/manifest.txt"

# Verify before touching anything. A truncated copy that half-restores is worse
# than one that refuses to start.
if [ -f "$SRC/checksums.txt" ]; then
  echo "Verifying checksums..."
  if ! (cd "$SRC" && sha256sum -c checksums.txt >/dev/null 2>&1); then
    echo "Checksums do not match — this backup is damaged. Refusing to restore." >&2
    exit 1
  fi
  echo "  ok"
else
  echo "  (no checksums.txt — cannot verify integrity)"
fi

if [ "$CONFIRM" != "--yes" ]; then
  cat <<EOF

This would:
  - stop the app (the database must not change under it mid-restore)
  - DROP and recreate the database "$MYSQL_DATABASE", discarding everything in it
  - replace the contents of the ${PROJECT}_uploads volume
  - start the app again

Nothing has been changed. Re-run with --yes to proceed.
EOF
  exit 0
fi

echo ""
echo "Stopping the app..."
docker compose stop app >/dev/null

echo "Restoring the database..."
# Recreate rather than restore over the top: leftover rows from the current
# database would otherwise survive alongside the restored ones, which looks
# like a successful restore and is not.
docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
  mysql --user=root -e \
  "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

gzip -dc "$SRC/database.sql.gz" |
  docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
    mysql --user=root --default-character-set=utf8mb4 "$MYSQL_DATABASE"

if [ -f "$SRC/uploads.tar.gz" ]; then
  echo "Restoring uploads..."
  # Piped in on stdin rather than bind-mounted, for the same reasons as the
  # backup side. The volume is emptied first: extracting over the top would
  # leave files that exist now but did not exist when the backup was taken,
  # which looks like a successful restore and is not.
  docker run --rm -i -v "${PROJECT}_uploads:/dst" alpine:3 \
    sh -c 'rm -rf /dst/..?* /dst/.[!.]* /dst/* 2>/dev/null; tar xzf - -C /dst' \
    <"$SRC/uploads.tar.gz"
else
  echo "No uploads.tar.gz in this backup — leaving the uploads volume alone."
  echo "  (expected when the backup was taken with STORAGE_DRIVER=s3)"
fi

echo "Starting the app..."
docker compose up -d app >/dev/null

echo ""
echo "Restored. Check it before you trust it:"
echo "  docker compose ps"
echo "  curl -fsS localhost:${APP_PORT:-3000}/api/ready"
echo ""
echo "If the backup predates your current image, the schema may be older than"
echo "the code. Run the migration job to bring it forward:"
echo "  docker compose up migrate"
