#!/usr/bin/env node
/**
 * اختبار تكاملي — ميزات v2.5.0:
 * 1) MongoDB مؤقت + خادم موحّد بوضع الإنتاج
 * 2) /api/stats يرجع victims (عداد المتضررين)
 * 3) /api/gratitude: زرع تلقائي + نص ثلاثي + update يحفظ النص والرمز + MISSING_LANGUAGES
 * 4) تسجيل مختص بصورة شخصية (photo) → تظهر في /api/counselors
 * 5) update-profile: تغيير الصورة ثم حذفها (null) → تنعكس في /api/counselors
 * 6) admin list-sessions: قائمة جلسات للتصدير
 */
const { spawn } = require("child_process");
const mongoose = require("mongoose");

const PORT = 3203;
const BASE = `http://127.0.0.1:${PORT}`;
let fails = 0;
const ok = (name, cond) => {
  console.log((cond ? "✅" : "❌") + " " + name);
  if (!cond) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
};
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDP/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

async function main() {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  console.log("⏳ تشغيل MongoDB مؤقت في الذاكرة...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-nafsi");

  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: uri, ADMIN_PASSCODE: "test-pass-123", PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d.toString()));
  server.stderr.on("data", (d) => (serverLog += d.toString()));

  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      await wait(1000);
      try {
        up = (await fetch(`${BASE}/api/health`)).ok;
      } catch {}
    }
    if (!up) throw new Error("الخادم لم يقلع:\n" + serverLog.slice(-800));
    console.log("🟢 الخادم الموحّد يعمل (إنتاج)\n");

    /* 2) stats: victims */
    const stats = await (await fetch(`${BASE}/api/stats`)).json();
    ok("stats يرجع victims (0 في البداية)", typeof stats.victims === "number" && stats.victims === 0);

    /* 3) gratitude */
    const g1 = await (await fetch(`${BASE}/api/gratitude`)).json();
    ok("الزرع التلقائي لنص الشكر (نص ثلاثي + رمز ❤️)", g1.content && g1.content.textAr && g1.content.textFr && g1.content.textEn && g1.content.symbol === "❤️");
    const badG = await post("/api/gratitude", { action: "update", textAr: "عربي فقط" });
    ok("update ناقص اللغات → 400 MISSING_LANGUAGES", badG.status === 400 && badG.data.error === "MISSING_LANGUAGES");
    const updG = await post("/api/gratitude", {
      action: "update",
      textAr: "شكر لكل من ساندنا 🇩🇿",
      textFr: "Merci à tous ceux qui nous ont soutenus",
      textEn: "Thanks to everyone who supported us",
      symbol: "🌹",
    });
    ok("update كامل → ok + رمز 🌹", updG.status === 200 && updG.data.ok && updG.data.content.symbol === "🌹");
    const g2 = await (await fetch(`${BASE}/api/gratitude`)).json();
    ok("النص المحدّث يظهر في GET العام", g2.content.textAr === "شكر لكل من ساندنا 🇩🇿" && g2.content.symbol === "🌹");

    /* 4) تسجيل مختص بصورة شخصية */
    const reg = await post("/api/counselor", {
      action: "register",
      fullName: "د. اختبار الصورة",
      email: "photo-test@example.com",
      password: "strong-pass-123",
      recoveryPhrase: "عبارة استرجاع كافية",
      whatsapp: "0555123456",
      specialties: ["trauma"],
      languages: ["ar"],
      yearsExperience: 5,
      diplomaImage: PHOTO,
      photo: PHOTO,
    });
    ok("تسجيل مختص مع photo → ok", reg.status === 200 && reg.data.ok);
    /* توثيق المختص عبر الأدمين — قائمة /api/counselors تعرض الموثّقين فقط */
    const pend = await post("/api/admin", { action: "pending-counselors" });
    const pid = (pend.data.pending || [])[0]?.id;
    const ver = pid ? await post("/api/admin", { action: "verify", profileId: pid }) : null;
    ok("توثيق المختص عبر الأدمين → ok", !!ver && ver.data.ok === true);
    const cs1 = await (await fetch(`${BASE}/api/counselors`)).json();
    ok("photo موجودة في /api/counselors", cs1.counselors.length === 1 && !!cs1.counselors[0].photo);

    /* 5) تغيير ثم حذف الصورة عبر update-profile */
    const login = await post("/api/counselor", { action: "login", email: "photo-test@example.com", password: "strong-pass-123" });
    ok("دخول المختص → ok + photo في الجلسة", login.data.ok && login.data.user.photo);
    const uid = login.data.user.id;
    const chg = await post("/api/counselor", { action: "update-profile", userId: uid, photo: PHOTO });
    ok("تغيير الصورة → ok", chg.status === 200 && chg.data.ok);
    const del = await post("/api/counselor", { action: "update-profile", userId: uid, photo: null });
    ok("حذف الصورة → ok", del.status === 200 && del.data.ok);
    const cs2 = await (await fetch(`${BASE}/api/counselors`)).json();
    ok("الصورة null بعد الحذف", cs2.counselors.length === 1 && cs2.counselors[0].photo === null);

    /* 6) admin list-sessions */
    const ls = await post("/api/admin", { action: "list-sessions" });
    ok("admin list-sessions → قائمة (فارغة الآن)", ls.status === 200 && Array.isArray(ls.data.sessions) && ls.data.sessions.length === 0);
  } catch (e) {
    console.error("❌", e.message);
    fails++;
  } finally {
    server.kill("SIGTERM");
    await wait(500);
    try {
      await mongod.stop();
    } catch {}
  }

  console.log("\n════════════════════════════════");
  console.log(fails === 0 ? "🎉 كل اختبارات v2.5.0 نجحت" : `💥 ${fails} اختبار فشل`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e);
  process.exit(1);
});
