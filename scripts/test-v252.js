#!/usr/bin/env node
/**
 * اختبار تكاملي v2.5.2 — الحل النهائي لإشعارات الهاتف:
 * 1) ثبات مفاتيح VAPID المشتقة: نفس البذرة = نفس المفتاح عبر "إعادة نشر"
 *    كاملة (خادم جديد + مجلد بيانات فارغ) — هذا ما كان يكسر الاشتراكات سابقاً
 * 2) أولوية المصادر: env > ملف vapid.json > الاشتقاق الحتمي
 * 3) صلاحية المفاتيح المشتقة لدى web-push فعلياً (توقيع VAPID JWT ينجح)
 * 4) دورة اشتراك كاملة: حفظ → إرسال تجريبي لنقطة منتهية → تنظيف تلقائي للاشتراك
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const webpush = require("web-push");
const mongoose = require("mongoose");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond) => {
  console.log((cond ? "✅" : "❌") + " " + name);
  if (!cond) fails++;
};

function freshDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rafiqi-data-"));
}

function startServer(port, env = {}) {
  const child = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MONGODB_URI: globalThis.__MONGO_URI,
      ADMIN_PASSCODE: "push-test-pass",
      PORT: String(port),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.log = "";
  child.stdout.on("data", (d) => (child.log += d));
  child.stderr.on("data", (d) => (child.log += d));
  return child;
}

async function getVapidKey(port) {
  const r = await fetch(`http://127.0.0.1:${port}/api/vapid-key`);
  const j = await r.json();
  return j.publicKey;
}

async function stopServer(child) {
  child.kill("SIGTERM");
  await wait(600);
}

/* مفتاح اشتراك p256dh صالح البنية (65 بايت) بنفس أسلوب الاشتقاق — لاختبار توقيع web-push */
function deriveSubscriptionKey(seed) {
  let d = crypto.createHash("sha256").update("sub-seed:" + seed).digest();
  const n = Buffer.from("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", "hex");
  while (Buffer.compare(d, n) >= 0) d = crypto.createHash("sha256").update(d).digest();
  const der = Buffer.concat([
    Buffer.from("3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420", "hex"),
    d,
  ]);
  const jwk = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" }).export({ format: "jwk" });
  const p256dh = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
  return { p256dh, auth: crypto.randomBytes(16).toString("base64url") };
}

async function main() {
  /* MongoDB مؤقت مشترك بين كل الخوادم المُشتغلة في هذا الاختبار */
  const { MongoMemoryServer } = require("mongodb-memory-server");
  console.log("⏳ تشغيل MongoDB مؤقت في الذاكرة...");
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGO_URI = mongod.getUri("rafiqi-push-test");

  /* ─── 1) ثبات الاشتقاق عبر "إعادة نشر" (خادم جديد + مجلد بيانات فارغ) ─── */
  const dirA = freshDataDir();
  const s1 = startServer(3191, { DATA_DIR: dirA });
  for (let i = 0; i < 60; i++) { await wait(1000); try { if ((await fetch("http://127.0.0.1:3191/api")).ok) break; } catch {} }
  const keyA = await getVapidKey(3191);
  ok("الخادم 1: مفتاح مشتق من بذرة ثابتة", !!keyA && keyA.length === 87);
  await stopServer(s1);

  const dirB = freshDataDir(); /* مجلد بيانات جديد تماماً = محاكاة إعادة نشر كاملة */
  const s2 = startServer(3192, { DATA_DIR: dirB });
  for (let i = 0; i < 60; i++) { await wait(1000); try { if ((await fetch("http://127.0.0.1:3192/api")).ok) break; } catch {} }
  const keyB = await getVapidKey(3192);
  ok("الخادم 2 (بعد إعادة نشر بمجلد فارغ): نفس المفتاح تماماً ← لا انكسار للاشتراكات", keyA === keyB);
  await stopServer(s2);

  /* ─── 2) أولوية ملف vapid.json القديم (توافق بلا انقطاع للمفاتيح السابقة) ─── */
  const legacy = webpush.generateVAPIDKeys();
  const dirC = freshDataDir();
  fs.writeFileSync(path.join(dirC, "vapid.json"), JSON.stringify(legacy, null, 2));
  const s3 = startServer(3193, { DATA_DIR: dirC });
  for (let i = 0; i < 60; i++) { await wait(1000); try { if ((await fetch("http://127.0.0.1:3193/api")).ok) break; } catch {} }
  const keyC = await getVapidKey(3193);
  ok("ملف vapid.json القديم له الأولوية (مفاتيح الإنتاج الحالية لا تتغير)", keyC === legacy.publicKey);
  await stopServer(s3);

  /* ─── 3) أولوية متغيرات البيئة ─── */
  const envKeys = webpush.generateVAPIDKeys();
  const s4 = startServer(3194, {
    DATA_DIR: freshDataDir(),
    VAPID_PUBLIC_KEY: envKeys.publicKey,
    VAPID_PRIVATE_KEY: envKeys.privateKey,
  });
  for (let i = 0; i < 60; i++) { await wait(1000); try { if ((await fetch("http://127.0.0.1:3194/api")).ok) break; } catch {} }
  const keyD = await getVapidKey(3194);
  ok("متغيرات البيئة تتفوق على كل شيء", keyD === envKeys.publicKey);

  /* ─── 4) دورة اشتراك + إرسال حقيقي بمفاتيح مشتقة (التوقيع يثبت الصلاحية) ─── */
  const victim = await (async () => {
    const r = await fetch("http://127.0.0.1:3194/api/victim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", pseudonym: "متضرر-بوش-" + Date.now(), password: "victim-pass-1", recoveryPhrase: "مدينتي وطفولتي" }),
    });
    return (await r.json()).user;
  })();
  ok("متضرر تجريبي مُسجل", !!victim?.id);

  const subKeys = deriveSubscriptionKeysHelper();
  const fakeEndpoint = "https://updates.push.services.mozilla.com/wpush/v2/FAKE" + crypto.randomBytes(8).toString("hex");
  const subRes = await fetch("http://127.0.0.1:3194/api/push", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "subscribe", userId: victim.id, role: "VICTIM", subscription: { endpoint: fakeEndpoint, keys: subKeys } }),
  });
  ok("حفظ الاشتراك على الخادم", subRes.ok);

  /* إرسال تجريبي: web-push يوقّع JWT بمفاتيحنا المشتقة ثم يضرب نقطة منتهية (404)
     — إن كانت المفاتيح فاسدة لفشل التوقيع محلياً بـ500، ونجاح هذا الفحص يثبت صحتها */
  const testRes = await fetch("http://127.0.0.1:3194/api/push", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test", userId: victim.id }),
  });
  const testJson = await testRes.json().catch(() => ({}));
  ok("إرسال بمفاتيح مشتقة: التوقيع نجح والنقطة المنتهية أزيلت (404→تنظيف)", testRes.status === 200 && testJson.ok === false && testJson.error === "NO_SUBSCRIPTION");

  /* التأكد من الحذف التلقائي للاشتراك الميت من القاعدة */
  const conn = await mongoose.createConnection(globalThis.__MONGO_URI).asPromise();
  await wait(800);
  const remaining = await conn.db.collection("push_subscriptions").countDocuments({ userId: new mongoose.Types.ObjectId(victim.id) });
  ok("الاشتراك الميت حُذف تلقائياً من القاعدة (لا رسائل ميتة متراكمة)", remaining === 0);
  await conn.close();
  await stopServer(s4);
  await mongod.stop();

  console.log("\n══════════════════════════════════");
  if (fails === 0) console.log("🎉 كل اختبارات الإشعارات v2.5.2 نجحت — المفاتيح مستقرة والاشتراكات محصّنة");
  else console.log(`⚠️  ${fails} اختبار فاشل`);
  process.exit(fails === 0 ? 0 : 1);
}

function deriveSubscriptionKeysHelper() {
  return deriveSubscriptionKey("push-test-sub");
}

main().catch((e) => {
  console.error("❌ فشل سكربت الاختبار:", e);
  process.exit(1);
});
