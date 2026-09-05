/**
 * يغلّف كل مُعرّفات مسارات API بـ apiHandler — شبكة أمان ضد الاستجابات الفارغة.
 * الاستخدام: node scripts/wrap-api-handlers.js
 * يعمل مرة واحدة (يغير export async function X → X_impl + export const X = apiHandler(X_impl))
 */
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "src", "app", "api");
const HANDLERS = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const IMPORT_LINE = 'import { apiHandler } from "@/lib/server/api";';

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
    );
}

const files = walk(API_DIR).filter((f) => f.endsWith("route.ts"));
let touched = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("apiHandler")) {
    console.log("skip (already wrapped):", path.relative(process.cwd(), file));
    continue;
  }

  const found = [];
  for (const h of HANDLERS) {
    const re = new RegExp(`export async function ${h}\\(`, "g");
    if (re.test(src)) {
      found.push(h);
      src = src.replace(
        new RegExp(`export async function ${h}\\(`, "g"),
        `async function ${h}_impl(`
      );
    }
  }

  if (!found.length) {
    console.log("no handlers:", path.relative(process.cwd(), file));
    continue;
  }

  /* إدراج الاستيراد بعد آخر سطر استيراد موجود (أو في الأعلى) */
  const lines = src.split("\n");
  let lastImport = -1;
  lines.forEach((l, i) => {
    if (/^import\s/.test(l)) lastImport = i;
  });
  lines.splice(lastImport + 1, 0, IMPORT_LINE);
  src = lines.join("\n");

  /* تصدير المُغلّفات في نهاية الملف */
  const exports = found
    .map((h) => `export const ${h} = apiHandler(${h}_impl);`)
    .join("\n");
  src = src.replace(/\n*$/, "\n\n") + exports + "\n";

  fs.writeFileSync(file, src);
  touched++;
  console.log(
    "wrapped:",
    path.relative(process.cwd(), file),
    "→",
    found.join(", ")
  );
}

console.log(`\n✅ ${touched} ملفًا تم تغليفه`);
