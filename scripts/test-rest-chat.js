#!/usr/bin/env node
/**
 * اختبار تكاملي — مسار المحادثة REST (v2.3.2):
 * 1) MongoDB مؤقت + جلسة مزروعة
 * 2) خادم موحّد بوضع الإنتاج (كما على Railway)
 * 3) POST /api/messages يحفظ ويرد برسالة سليمة
 * 4) جسر REST → Socket.io: عميل في الغرفة يستلم الرسالة المرسلة عبر REST لحظياً
 * 5) GET /api/messages?since= يجلب الجديد فقط (وضع المزامنة على Vercel)
 * 6) كشف الأزمة عبر REST: crisis في الرد + crisis_logs + crisisFlag
 */
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { io } = require("socket.io-client");

const PORT = 3201;
const BASE = `http://127.0.0.1:${PORT}`;
let fails = 0;
const ok = (name, cond) => {
  console.log((cond ? "✅" : "❌") + " " + name);
  if (!cond) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  /* 1) MongoDB مؤقت + جلسة مزروعة */
  const { MongoMemoryServer } = require("mongodb-memory-server");
  console.log("⏳ تشغيل MongoDB مؤقت في الذاكرة...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-nafsi");
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();

  const SessionSchema = new mongoose.Schema(
    {
      victimId: mongoose.Types.ObjectId,
      counselorId: mongoose.Types.ObjectId,
      topic: String,
      status: { type: String, default: "ACTIVE" },
      crisisFlag: { type: Boolean, default: false },
    },
    { collection: "sessions" }
  );
  const Session = conn.model("SupportSession", SessionSchema);
  const victimId = new mongoose.Types.ObjectId();
  const counselorId = new mongoose.Types.ObjectId();
  const session = await Session.create({
    victimId,
    counselorId,
    topic: "اختبار مسار REST",
    status: "ACTIVE",
  });
  await conn.close();

  /* 2) الخادم الموحّد */
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
        const r = await fetch(`${BASE}/api/health`);
        up = r.ok;
      } catch {}
    }
    if (!up) throw new Error("الخادم لم يقلع:\n" + serverLog.slice(-800));
    console.log("🟢 الخادم الموحّد يعمل (إنتاج)\n");

    const sid = String(session._id);

    /* 3) POST /api/messages — حفظ ورد سليم */
    const post1 = await fetch(`${BASE}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, senderRole: "COUNSELOR", senderName: "د. سلام", content: "مرحباً، أنا هنا معك" }),
    });
    const d1 = await post1.json();
    ok("POST /api/messages → 200 + ok + message", post1.status === 200 && d1.ok && d1.message && d1.message.id);
    ok("لا أزمة في رسالة عادية", d1.crisis === null || d1.crisis === undefined);

    /* 4) جسر REST → Socket.io: عميل في الغرفة يستلم لحظياً */
    const got = await new Promise(async (resolve) => {
      const s = io(BASE, { path: "/socket.io", transports: ["websocket", "polling"], forceNew: true, timeout: 8000 });
      let resolved = false;
      const done = (v) => {
        if (!resolved) {
          resolved = true;
          s.disconnect();
          resolve(v);
        }
      };
      s.on("connect", () => s.emit("join_session", { sessionId: sid, role: "VICTIM", name: "أمين" }));
      s.on("text_message", (m) => done(m));
      setTimeout(() => done(null), 15000);
      /* نرسل عبر REST بعد اتصال العميل بقليل */
      setTimeout(async () => {
        await fetch(`${BASE}/api/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, senderRole: "COUNSELOR", senderName: "د. سلام", content: "رسالة عبر الجسر" }),
        });
      }, 2500);
    });
    ok("جسر REST → Socket.io (بث لحظي على الخادم الموحّد)", !!got && got.content === "رسالة عبر الجسر" && got.senderRole === "COUNSELOR");
    if (!got) console.log("   ↳ لم تصل أي رسالة عبر الغرفة — الرد الأصلي:", JSON.stringify(got));
    ok("الرسالة المبثوة تحمل id حقيقي من القاعدة", !!got && !String(got.id).startsWith("tmp-"));

    /* 5) GET ?since= — الجديد فقط */
    const all = await (await fetch(`${BASE}/api/messages?sessionId=${sid}`)).json();
    ok("GET كامل يعيد الرسالتين", all.messages.length === 2);
    const since = all.messages[0].createdAt;
    const fresh = await (await fetch(`${BASE}/api/messages?sessionId=${sid}&since=${encodeURIComponent(since)}`)).json();
    ok("GET ?since= يعيد الأحدث فقط", fresh.messages.length === 1 && fresh.messages[0].content === "رسالة عبر الجسر");
    if (fresh.messages.length !== 1) console.log("   ↳ since ردّ:", JSON.stringify(fresh.messages.map((m) => [m.content, m.createdAt])).slice(0, 400), "since=", since);

    /* 6) كشف الأزمة عبر REST */
    const postCrisis = await fetch(`${BASE}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, senderRole: "VICTIM", senderName: "أمين", content: "لا معنى لحياتي الآن" }),
    });
    const dCrisis = await postCrisis.json();
    ok("POST رسالة أزمة → crisis بالعبارة في الرد", postCrisis.status === 200 && dCrisis.ok && dCrisis.crisis === "لا معنى لحياتي");
    if (!(postCrisis.status === 200 && dCrisis.ok)) console.log("   ↳ رد الأزمة:", postCrisis.status, JSON.stringify(dCrisis).slice(0, 400));

    /* تحقق قاعدي: crisisFlag + crisis_logs */
    const cconn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
    const s2 = cconn.model("SupportSession", SessionSchema);
    const updated = await s2.findById(sid);
    ok("علم الأزمة على الجلسة (crisisFlag=true)", updated && updated.crisisFlag === true);
    const logs = await cconn.collection("crisis_logs").find({ sessionId: sid, source: "REST_API" }).toArray();
    ok("سجل الأزمة مدوّن بمصدر REST_API", logs.length === 1 && logs[0].phrase === "لا معنى لحياتي");
    await cconn.close();

    /* 7) أخطاء شكلية */
    const bad = await fetch(`${BASE}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, content: "ناقص" }),
    });
    ok("POST ناقص الحقول → 400 JSON سليم", bad.status === 400);
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
  console.log(fails === 0 ? "🎉 كل اختبارات مسار REST نجحت" : `💥 ${fails} اختبار فشل`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e);
  process.exit(1);
});
