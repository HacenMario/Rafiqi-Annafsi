/**
 * اختبار v2.10.0 — إصلاح الحجز + محادثة الإدارة + العبارات الست اللغات
 * ─────────────────────────────────────────────────────────────
 *  1. نافذة الحجز: أخصائي بجدول (10:00/11:00/15:00) — الحجز في موعد حر ينجح
 *     والمحجوب SLOT_TAKEN والخارج عن الجدول SLOT_UNAVAILABLE
 *  2. taken-slots يعيد الموعد المحجوز فعلاً فقط
 *  3. محادثة الإدارة: المختص يرسل → ينجح، متضرر → 403، مختص آخر → 403
 *     الإدارة ترد → ينجح + إشعار داخلي للمختص + admin-threads يعرض الخيط
 *  4. العبارات: 115 عبارة نشطة كاملة الحقول الستة (tr/ru/zh غير فارغة)
 *  5. انحدار: VICTIM_UNVERIFIED للـ fire PENDING + يوم-جلسة-واحدة
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");

const PORT = String(3100 + (process.pid % 400) + Math.floor(Math.random() * 100));
const BASE = `http://localhost:${PORT}`;
let failures = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => { let j = null; try { j = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.log(`  ❌ ${name} ${extra}`); }
}
function futureDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const isoAt = (date, slot) => new Date(`${date}T${slot}:00+01:00`).toISOString();

(async () => {
  console.log("═".repeat(56));
  console.log("🧪 اختبار v2.10.0 — الحجز والمحادثة مع الإدارة والعبارات");
  console.log("═".repeat(56));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-v2100");
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT, MONGODB_URI: uri, ADMIN_PASSCODE: "v2100-pass", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  let ready = false;
  for (let i = 0; i < 60; i++) { try { const h = await req("GET", "/api/health"); if (h.json?.version === "2.10.0") { ready = true; break; } } catch {} await wait(500); }
  check("الخادم v2.10.0 جاهز", ready);

  /* ─── حسابات ─── */
  const vA = (await req("POST", "/api/victim", { action: "register", pseudonym: "متضرر-عشرة-أ", password: "pass-2100-safe", recoveryPhrase: "عبارة استرجاع أ", gender: "male" })).json.user;
  const vB = (await req("POST", "/api/victim", { action: "register", pseudonym: "متضرر-عشرة-ب", password: "pass-2100-safe", recoveryPhrase: "عبارة استرجاع ب", gender: "female" })).json.user;
  check("تسجيل متضررين", !!vA?.id && !!vB?.id);

  const cReg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. عاشرة", email: `t2100-${Date.now()}@t.dz`, password: "pass-2100-safe", recoveryPhrase: "عبارة أخصائي",
    whatsapp: "0555210001", specialties: ["trauma"], languages: ["ar"], yearsExperience: 5,
  });
  const counselorId = cReg.json?.userId;
  check("تسجيل أخصائي", !!counselorId);
  const cLogin = (await req("POST", "/api/counselor", { action: "login", email: cReg.json ? await (async () => cReg.json.userId ? "x" : "x")() : "x", password: "x" }));

  /* الأدمين يوثّق */
  await req("POST", "/api/admin", { action: "login", passcode: "v2100-pass" });
  const pend = (await req("POST", "/api/admin", { action: "pending-counselors" })).json;
  for (const p of pend.all || []) await req("POST", "/api/admin", { action: "verify", profileId: p.id });

  /* ─── 1) نافذة الحجز المنطق الجديد ─── */
  console.log("\n── 1) منطق الحجز: المتاح أخضر والخارج عن الجدول مرفوض ──");
  const avail = {};
  for (let d = 0; d < 7; d++) avail[String(d)] = ["10:00", "11:00", "15:00"];
  const saved = await req("POST", "/api/counselor", { action: "set-availability", userId: counselorId, weeklyAvailability: avail });
  check("حفظ جدول التوفر", saved.json?.ok === true && saved.json?.weeklyAvailability?.["0"]?.length === 3);

  const list = (await req("GET", "/api/counselors")).json.counselors || [];
  const c = list.find((x) => x.userId === counselorId);
  check("الجدول يصل للواجهة (weeklyAvailability)", !!c && JSON.stringify(c.weeklyAvailability?.["1"]) === JSON.stringify(["10:00", "11:00", "15:00"]));

  /* متضرر ب يحجز 10:00 غداً */
  const b1 = await req("POST", "/api/sessions", {
    victimId: vB.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: isoAt(futureDate(2), "10:00"), date: futureDate(2), slot: "10:00",
  });
  check("متضرر ب حجز 10:00 غداً", b1.json?.ok === true);

  /* متضرر أ يجرب نفس الموعد → SLOT_TAKEN */
  const b2 = await req("POST", "/api/sessions", {
    victimId: vA.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: isoAt(futureDate(2), "10:00"), date: futureDate(2), slot: "10:00",
  });
  check("نفس الموعد لمتضرر أ → SLOT_TAKEN", b2.json?.error === "SLOT_TAKEN");

  /* موعد حر 11:00 → ينجح */
  const b3 = await req("POST", "/api/sessions", {
    victimId: vA.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: isoAt(futureDate(2), "11:00"), date: futureDate(2), slot: "11:00",
  });
  check("موعد حر 11:00 ينجح للمتضرر أ", b3.json?.ok === true);

  /* خارج الجدول 13:00 → SLOT_UNAVAILABLE */
  const b4 = await req("POST", "/api/sessions", {
    victimId: vA.id, counselorId, topic: "other", mode: "TEXT",
    scheduledAt: isoAt(futureDate(3), "13:00"), date: futureDate(3), slot: "13:00",
  });
  check("خارج الجدول 13:00 → SLOT_UNAVAILABLE", b4.json?.error === "SLOT_UNAVAILABLE");

  const taken = (await req("GET", `/api/taken-slots?counselorId=${counselorId}&days=21`)).json.taken || {};
  check("taken-slots يعيد الموعدين المحجوزين فقط", JSON.stringify(taken[futureDate(2)]?.sort()) === JSON.stringify(["10:00", "11:00"]));

  /* ─── 2) محادثة الإدارة ─── */
  console.log("\n── 2) محادثة المختص مع الإدارة ──");
  const thread = `admin:${counselorId}`;
  const m1 = await req("POST", "/api/messages", { threadKey: thread, senderRole: "COUNSELOR", senderId: counselorId, senderName: "د. عاشرة", content: "مرحباً، أحتاج مساعدة في إعدادات حسابي" });
  check("المختص يرسل للإدارة → ok", m1.json?.ok === true);

  const m2 = await req("POST", "/api/messages", { threadKey: thread, senderRole: "VICTIM", senderId: vA.id, senderName: "متضرر", content: "أنا متضرر أحاول" });
  check("متضرر في خيط الإدارة → 403", m2.status === 403);

  const m3 = await req("POST", "/api/messages", { threadKey: thread, senderRole: "COUNSELOR", senderId: "000000000000000000000000", senderName: "منتحل", content: "أنا مختص آخر" });
  check("مختص في خيط غيره → 403", m3.status === 403);

  const m4 = await req("POST", "/api/messages", { threadKey: thread, senderRole: "ADMIN", senderName: "إدارة المنصة", content: "أهلاً بك، سنراجع إعداداتك اليوم" });
  check("الإدارة ترد → ok", m4.json?.ok === true && m4.json?.message?.senderRole === "ADMIN");

  /* قراءة الخيط */
  const th = (await req("GET", `/api/messages?threadKey=${encodeURIComponent(thread)}`)).json.messages || [];
  check("الخيط يحمل الرسالتين", th.length === 2);

  /* إشعار داخلي للمختص (غائب — lastSeenAt null) بعد رد الإدارة */
  await wait(300);
  const notifs = (await req("GET", `/api/notifications?userId=${counselorId}`)).json.notifications || [];
  check("إشعار محادثة الإدارة وصل للمختص", notifs.some((n) => n.key === "adminChat" && (n.url || "").includes("admin-chat")));

  /* إشعار للأدمين من رسالة المختص (آخر حساب أدمين غائب) */
  const adminLogin = (await req("POST", "/api/admin", { action: "login", passcode: "v2100-pass" })).json.user;
  const adminNotifs = (await req("GET", `/api/notifications?userId=${adminLogin.id}`)).json.notifications || [];
  check("إشعار رسالة المختص وصل للأدمين", adminNotifs.some((n) => n.key === "adminChat"));

  /* صندوق الإدارة */
  const threads = (await req("POST", "/api/admin", { action: "admin-threads" })).json.threads || [];
  check("admin-threads يعرض الخيط باسم المختص والعدّ", threads.length === 1 && threads[0].counselorName === "د. عاشرة" && threads[0].count === 2);

  /* ─── 3) العبارات الست لغات ─── */
  console.log("\n── 3) مكتبة العبارات ──");
  const q = (await req("GET", "/api/quotes")).json;
  check("115 عبارة نشطة", q.total === 115);
  check("كل عبارة بالست لغات (لا فراغات)", (q.quotes || []).every((x) => x.textAr && x.textFr && x.textEn && x.textTr && x.textRu && x.textZh));

  /* ─── 4) انحدار: fire PENDING يمنع الحجز ─── */
  console.log("\n── 4) انحدار: توثيق الحرائق ──");
  const vC = (await req("POST", "/api/victim", { action: "register", pseudonym: "متضرر-نار", password: "pass-2100-safe", recoveryPhrase: "عبارة نار", gender: "male", fireVictim: true, fireCommune: "تمنراست", fireDate: "2025-08-01", fireDesc: "احترق البيت" })).json.user;
  const b5 = await req("POST", "/api/sessions", {
    victimId: vC.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: isoAt(futureDate(4), "15:00"), date: futureDate(4), slot: "15:00",
  });
  check("fire PENDING → VICTIM_UNVERIFIED", b5.json?.error === "VICTIM_UNVERIFIED");
  await req("POST", "/api/admin", { action: "verify-victim", victimId: vC.id, approve: true });
  const b6 = await req("POST", "/api/sessions", {
    victimId: vC.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: isoAt(futureDate(4), "15:00"), date: futureDate(4), slot: "15:00",
  });
  check("بعد التوثيق الحجز ينجح", b6.json?.ok === true);

  /* يوم-جلسة-واحدة */
  const b7 = await req("POST", "/api/sessions", {
    victimId: vC.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: isoAt(futureDate(5), "10:00"), date: futureDate(5), slot: "10:00",
  });
  check("جلسة ثانية في يوم آخر تُقبل (لا تعارض)", b7.json?.ok === true);

  await server.kill("SIGKILL");
  await mongod.stop();

  console.log("═".repeat(56));
  if (failures === 0) console.log("🎉 كل فحوص v2.10.0 خضراء");
  else { console.log(`💥 ${failures} فحصاً فاشلاً`); process.exit(1); }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
