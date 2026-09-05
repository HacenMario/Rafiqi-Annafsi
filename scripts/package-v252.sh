#!/bin/bash
# Package Rafiqi Nafsi v2.5.2 modified files + PowerShell uploader
set -e
SRC=/home/z/my-project
STG=$SRC/scripts/staging-v252
OUT=$SRC/download/rafiqi-nafsi-v252-github.zip

cd "$SRC"

# 17 modified/new files for v2.5.2
FILES=(
  "server.js"
  "package.json"
  "README.md"
  "src/app/page.tsx"
  "src/app/api/health/route.ts"
  "src/app/api/route.ts"
  "src/app/api/vapid-key/route.ts"
  "src/app/api/push/route.ts"
  "src/lib/push-client.ts"
  "src/lib/server/push.ts"
  "src/lib/i18n/ar.ts"
  "src/lib/i18n/en.ts"
  "src/lib/i18n/fr.ts"
  "src/components/views/settings.tsx"
  "src/components/views/counselors-directory.tsx"
  "scripts/test-v252.js"
  "scripts/test-v251.js"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$SRC/$f" ]; then echo "MISSING: $f"; exit 1; fi
  mkdir -p "$STG/$(dirname "$f")"
  cp "$SRC/$f" "$STG/$f"
done

echo "--- staged files ---"
cd "$STG"
find . -type f | sort

rm -f "$OUT"
zip -r -q "$OUT" . -x "*.DS_Store"
echo "--- zip created ---"
ls -la "$OUT"
md5sum "$OUT"
unzip -l "$OUT" | tail -3
