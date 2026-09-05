#!/bin/bash
# Package Rafiqi Annafsi v2.9.0 — full source (no node_modules/.env/build artifacts)
set -e
SRC=/home/z/my-project
STG=$SRC/scripts/staging-v290
ROOT="$STG/Rafiqi-Annafsi-main"
OUT=$SRC/download/Rafiqi-Annafsi-v2.9.0.zip

rm -rf "$STG"
mkdir -p "$ROOT"

cd "$SRC"

# ─── الملفات والمجلدات المضمّنة (نفس بنية v2.5.5 + ملفات v2.9.0 الجديدة) ───
rsync -a \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.next' \
  --exclude 'db/*.db' \
  --exclude 'screens' \
  --exclude 'screenshots' \
  --exclude 'download' \
  --exclude 'tool-results' \
  --exclude 'skills' \
  --exclude 'examples' \
  --exclude 'tests' \
  --exclude '*.log' \
  --exclude '.git' \
  --exclude 'scripts/staging-*' \
  --exclude 'scripts/upload-*' \
  --exclude 'upload' \
  --exclude 'worklog.md' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude 'firms_live.csv' \
  --exclude 'firms_via_proxy.txt' \
  --exclude 'search_fires_*.json' \
  --exclude 'public_listing.json' \
  --exclude 'firesight_index.html' \
  /home/z/my-project/ "$ROOT/"

mkdir -p "$ROOT/db"
echo "# مجلد قاعدة البيانات — SQLite غير مستعمل في الإنتاج (MongoDB)" > "$ROOT/db/.gitkeep"

cd "$STG"
rm -f "$OUT"
zip -q -r "$OUT" Rafiqi-Annafsi-main

echo "=== PACKAGED ==="
echo "Files: $(unzip -l "$OUT" | tail -1 | awk '{print $2}')"
echo "Size:  $(du -h "$OUT" | cut -f1)"
echo "MD5:   $(md5sum "$OUT" | awk '{print $1}')"
# تحقق سلامة: لا أسرار ولا مخلفات بناء
if unzip -l "$OUT" | grep -qE "node_modules|\.env$|\.next/|dev\.log"; then echo "❌ تسريب ممنوعات!"; exit 1; fi
echo "=== CLEAN ✓ (no node_modules/.env/.next/logs) ==="
