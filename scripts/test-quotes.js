#!/usr/bin/env node
/**
 * اختبار تكاملي — عبارات الاطمئنان (v2.4.0):
 * 1) MongoDB مؤقت + خادم موحّد بوضع الإنتاج
 * 2) GET /api/quotes زرع تلقائي (65 عبارة) وكلها ثلاثية اللغة ونشطة
 * 3) create بدون لغة → 400 / create كامل → ok
 * 4) update (تعديل نص + تعطيل) — المعطّل لا يظهر في GET العام لكنه في list-all
 * 5) delete → يختفي من list-all
 * 6) unknown action → 400
 */
const { spawn } = require("child_process");
const mongoose = require("mongoose");

const PORT = 3202;
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

    /* 2) GET: زرع تلقائي */
    const g1 = await (await fetch(`${BASE}/api/quotes`)).json();
    ok("الزرع التلقائي: 65 عبارة", g1.total === 65);
    ok("كل عبارة ثلاثية اللغة ونشطة", g1.quotes.every((q) => q.textAr && q.textFr && q.textEn && q.active));
    ok("التصنيفات الثلاثة موجودة", ["religious", "social", "wisdom"].every((c) => g1.quotes.some((q) => q.category === c)));
    const g2 = await (await fetch(`${BASE}/api/quotes`)).json();
    ok("لا زرع مزدوج عند الطلب الثاني", g2.total === 65);

    /* 3) create */
    const bad = await post("/api/quotes", { action: "create", textAr: "فقط عربية" });
    ok("create ناقص اللغات → 400 MISSING_LANGUAGES", bad.status === 400 && bad.data.error === "MISSING_LANGUAGES");
    const created = await post("/api/quotes", {
      action: "create",
      textAr: "عبارة اختبار عربية",
      textFr: "Phrase de test FR",
      textEn: "Test phrase EN",
      author: "المختبر",
      category: "social",
    });
    ok("create كامل → ok + id", created.status === 200 && created.data.ok && created.data.quote.id);
    const qid = created.data.quote.id;

    /* 4) update */
    const upd = await post("/api/quotes", { action: "update", id: qid, textAr: "عبارة معدّلة", active: false });
    ok("update نص + تعطيل → ok", upd.status === 200 && upd.data.ok && upd.data.quote.textAr === "عبارة معدّلة" && upd.data.quote.active === false);
    const g3 = await (await fetch(`${BASE}/api/quotes`)).json();
    ok("المعطّل يختفي من GET العام", !g3.quotes.some((q) => q.id === qid));
    const la = await post("/api/quotes", { action: "list-all" });
    ok("المعطّل يظهر في list-all للأدمين", la.data.quotes.some((q) => q.id === qid && q.active === false));

    /* 5) delete */
    const del = await post("/api/quotes", { action: "delete", id: qid });
    ok("delete → ok", del.status === 200 && del.data.ok);
    const la2 = await post("/api/quotes", { action: "list-all" });
    ok("المحذوف اختفى نهائياً", !la2.data.quotes.some((q) => q.id === qid));

    /* 6) حدود */
    const nf = await post("/api/quotes", { action: "delete", id: "000000000000000000000000" });
    ok("delete غير موجود → 404", nf.status === 404);
    const ua = await post("/api/quotes", { action: "whatever" });
    ok("action مجهول → 400", ua.status === 400);
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
  console.log(fails === 0 ? "🎉 كل اختبارات العبارات نجحت" : `💥 ${fails} اختبار فشل`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e);
  process.exit(1);
});
