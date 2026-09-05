#!/usr/bin/env node
/**
 * اختبار تكاملي v2.5.1 — يغطي إصلاحات وطلبات المستخدم:
 * 1) الصحة 2.5.1  2) المواعيد الجديدة 09:00→21:00 بلا 12:00
 * 3) جنس المتضرر عند التسجيل والتحديث
 * 4) التخصصات المخصصة (تسجيل + ظهور في الدليل + تعديل من الإعدادات)
 * 5) عدّاد جلسات الأخصائي يُحسب مباشرة (ليس الحقل القديم الثابت)
 * 6) الحضور REST (نبض كل 10 ثوانٍ) + عبارة الانتظار حسب نوع الحساب
 * 7) إشعار رسالة جديدة للطرف الغائب عن الغرفة (ودون تكرار وهو حاضر)
 * 8) تذكير قبل ساعة من الموعد (داخلي + فوري) بدون تكرار
 * 9) إنشاء الجلسة تلقائياً من موعد المتابعة
 */
const { spawn } = require("child_process");
const fs = require("fs");
const mongoose = require("mongoose");

const PORT = 3198;
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
  try {
    return { status: r.status, data: await r.json() };
  } catch {
    return { status: r.status, data: {} };
  }
};
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`);
  try {
    return { status: r.status, data: await r.json() };
  } catch {
    return { status: r.status, data: {} };
  }
};

/* صورة PNG صغيرة 1x1 base64 */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  /* ─── 0) فحص ثابت: المواعيد الافتراضية ─── */
  const constantsSrc = fs.readFileSync("src/lib/constants.ts", "utf8");
  const slotBlock = constantsSrc.match(/export const SLOT_TIMES = \[([\s\S]*?)\];/)?.[1] || "";
  ok("المواعيد: تضم 09:00 و21:00", slotBlock.includes('"09:00"') && slotBlock.includes('"21:00"'));
  ok("المواعيد: لا جلسات على الساعة 12:00 (فطور)", !slotBlock.includes('"12:00"'));
  ok("المواعيد: 12 موعداً بفارق ساعة", (slotBlock.match(/"\d{2}:\d{2}"/g) || []).length === 12);

  /* ─── 1) MongoDB مؤقت ─── */
  const { MongoMemoryServer } = require("mongodb-memory-server");
  console.log("⏳ تشغيل MongoDB مؤقت في الذاكرة...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-nafsi");

  /* زرع أخصائي موثّق بعدّاد قديم فاسد (99) للتأكد من الحساب المباشر */
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const { randomBytes, scryptSync } = require("crypto");
  const hash = (s) => {
    const salt = randomBytes(16).toString("hex");
    return { hash: scryptSync(s, salt, 64).toString("hex"), salt };
  };
  const UserSchema = new mongoose.Schema(
    {
      pseudonym: String,
      role: String,
      language: { type: String, default: "ar" },
      email: { type: String, sparse: true, unique: true },
      passwordHash: String,
      passwordSalt: String,
      recoveryHash: String,
      recoverySalt: String,
    },
    { timestamps: true, collection: "users" }
  );
  const ProfileSchema = new mongoose.Schema(
    {
      userId: mongoose.Schema.Types.ObjectId,
      fullName: String,
      specialties: [String],
      customSpecialties: [String],
      languages: [String],
      whatsapp: String,
      yearsExperience: { type: Number, default: 0 },
      diplomaImage: String,
      photo: String,
      verificationStatus: { type: String, default: "PENDING" },
      available: { type: Boolean, default: true },
      rating: { type: Number, default: 5 },
      sessionsCount: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "counselors" }
  );
  const U = conn.model("User", UserSchema);
  const P = conn.model("CounselorProfile", ProfileSchema);
  const pw = hash("counselor-pass-1");
  const rec = hash("عبارة الأخصائي الاسترجاعية");
  const u = await U.create({
    role: "COUNSELOR",
    pseudonym: "د. تجربة",
    email: "test@local",
    passwordHash: pw.hash,
    passwordSalt: pw.salt,
    recoveryHash: rec.hash,
    recoverySalt: rec.salt,
  });
  await P.create({
    userId: u._id,
    fullName: "د. تجربة",
    specialties: ["trauma", "grief"],
    customSpecialties: ["العلاج بالفن"],
    languages: ["ar", "fr"],
    whatsapp: "213555000111",
    photo: TINY_PNG,
    diplomaImage: TINY_PNG,
    verificationStatus: "VERIFIED",
    sessionsCount: 99, /* عدّاد قديم ثابت — يجب أن يُهمل ويُحسب من الجلسات */
  });
  await conn.close();
  console.log("🌱 أخصائي اختبار مزروع (موثّق، عدّاد قديم = 99)");

  /* ─── 2) الخادم ─── */
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
    for (let i = 0; i < 60; i++) {
      await wait(1000);
      try {
        const r = await fetch(`${BASE}/api`);
        if (r.ok) { up = true; break; }
      } catch {}
    }
    if (!up) {
      console.error("❌ الخادم لم يقلع. السجل:\n" + serverLog.slice(-3000));
      process.exit(1);
    }
    console.log("🟢 الخادم يعمل على " + BASE);

    const health = await (await fetch(`${BASE}/api`)).json();
    ok("الإصدار 2.5.2+ يعمل والقاعدة متصلة", ["2.5.1", "2.5.2"].includes(health.version) && health.db === "connected");

    /* ─── 3) الجنس عند تسجيل المتضرر ─── */
    const stamp = Date.now();
    const vName = "متضرر-٢٥١-" + stamp;
    const vNoGender = await post("/api/victim", { action: "register", pseudonym: vName + "-بلا", password: "victim-pass-1", recoveryPhrase: "مدينتي وطفولتي" });
    ok("متضرر: تسجيل بلا جنس مقبول (توافق خلفي) والجنس null", vNoGender.data.ok === true && vNoGender.data.user?.gender === null);

    const vNameF = vName + "-فاطمة";
    const vReg = await post("/api/victim", { action: "register", pseudonym: vNameF, password: "victim-pass-1", recoveryPhrase: "مدينتي وطفولتي", gender: "female", wilaya: "alger", ageGroup: "age18_30" });
    ok("متضرر: تسجيل مع الجنس (أنثى) يُخزَّن ويرجع", vReg.data.ok === true && vReg.data.user?.gender === "female");
    const victimId = vReg.data.user.id;

    const vLogin = await post("/api/victim", { action: "login", pseudonym: vNameF, password: "victim-pass-1" });
    ok("متضرر: دخول يجلب الجنس", vLogin.data.ok === true && vLogin.data.user?.gender === "female");

    const vUpd = await post("/api/victim", { action: "update-profile", userId: victimId, gender: "female", wilaya: "oran" });
    ok("متضرر: تحديث الجنس من الإعدادات", vUpd.data.ok === true && vUpd.data.user?.gender === "female");

    /* ─── 4) التخصصات المخصصة ─── */
    const cEmail = `custom${stamp}@t.tt`;
    const cReg = await post("/api/counselor", {
      action: "register", fullName: "د. تخصصات", email: cEmail, password: "counselor-pass-1",
      recoveryPhrase: "جملتي السرية الخاصة", whatsapp: "0551234567",
      specialties: ["anxietyDepression"], customSpecialties: ["الاستشارة الأسرية", "  "], languages: ["ar"],
      yearsExperience: 2, diplomaImage: TINY_PNG,
    });
    ok("أخصائي: تسجيل بتخصصات مخصصة (تُطهَّر الفارغة)", cReg.data.ok === true);

    const admLogin = await post("/api/admin", { action: "login", passcode: "test-pass-123" });
    ok("أدمين: دخول", admLogin.data.ok === true);
    const pend = await post("/api/admin", { action: "pending-counselors" });
    const pendingProfile = (pend.data.pending || []).find((p) => p.fullName === "د. تخصصات");
    const verify = await post("/api/admin", { action: "verify", profileId: pendingProfile?.id });
    ok("أدمين: توثيق الأخصائي الجديد", verify.data.ok === true);

    const list = await (await fetch(`${BASE}/api/counselors`)).json();
    const seeded = (list.counselors || []).find((c) => c.fullName === "د. تجربة");
    const customC = (list.counselors || []).find((c) => c.fullName === "د. تخصصات");
    ok("دليل الأخصائيين: التخصصات المخصصة تظهر", !!customC && JSON.stringify(customC.customSpecialties) === JSON.stringify(["الاستشارة الأسرية"]));
    ok("دليل الأخصائيين: المزروع يعرض تخصصه المخصص والصورة", !!seeded && seeded.customSpecialties?.includes("العلاج بالفن") && seeded.photo === TINY_PNG);
    ok("دليل الأخصائيين: العدّاد يُحسب مباشرة (99 القديم مُهمل)", seeded?.sessionsCount === 0);

    /* تعديل التخصصات من الإعدادات: إضافة خاصة + حذف جاهز */
    const cId = customC.userId;
    const upd = await post("/api/counselor", { action: "update-profile", userId: cId, specialties: ["anxietyDepression", "grief"], customSpecialties: ["الاستشارة الأسرية", "الصدمات الجماعية"] });
    ok("أخصائي: تحديث التخصصات من الإعدادات", upd.data.ok === true);
    const list2 = await (await fetch(`${BASE}/api/counselors`)).json();
    const customC2 = (list2.counselors || []).find((c) => c.userId === cId);
    ok("أخصائي: التخصصات المحدثة تُقرأ من الدليل", customC2.specialties.includes("grief") && customC2.customSpecialties.includes("الصدمات الجماعية"));

    /* ─── 5) الحضور REST + عدّاد الجلسات الحيّ ─── */
    const sRes = await post("/api/sessions", { victimId, counselorId: seeded.userId, topic: "anxiety", mode: "TEXT", scheduledAt: new Date(Date.now() + 3600_000).toISOString() });
    ok("حجز جلسة بعد ساعة (للتذكير)", sRes.data.ok === true && !!sRes.data.session?.id);
    const sid = sRes.data.session.id;

    const acc = await patch2(`/api/sessions/${sid}`, { status: "ACCEPTED" });
    ok("قبول الجلسة", acc.data.ok === true && acc.data.session.status === "ACCEPTED");

    const beat1 = await post(`/api/sessions/${sid}/presence`, { role: "VICTIM" });
    ok("حضور: نبض المتضرر → الطرف الآخر غائب", beat1.data.ok === true && beat1.data.partnerPresent === false);
    const beatC = await post(`/api/sessions/${sid}/presence`, { role: "COUNSELOR" });
    ok("حضور: نبض الأخصائي → يرى المتضرر حاضراً", beatC.data.ok === true && beatC.data.partnerPresent === true);
    const beat2 = await post(`/api/sessions/${sid}/presence`, { role: "VICTIM" });
    ok("حضور: نبض المتضرر الثاني → يرى الأخصائي حاضراً", beat2.data.ok === true && beat2.data.partnerPresent === true);
    const beatBad = await post(`/api/sessions/${sid}/presence`, { role: "ADMIN" });
    ok("حضور: دور غير صالح → 400", beatBad.status === 400);

    /* ─── 6) إشعار رسالة جديدة للطرف الغائب ───
       جلسة جديدة من دون أي نبض حضور → الأخصائي غائب تماماً */
    const s2Res = await post("/api/sessions", { victimId, counselorId: seeded.userId, topic: "grief", mode: "TEXT" });
    const sid2 = s2Res.data.session.id;
    const cNotifsBefore = await (await fetch(`${BASE}/api/notifications?userId=${seeded.userId}`)).json();
    const beforeMsg = (cNotifsBefore.notifications || []).filter((n) => n.key === "message").length;
    const msg1 = await post("/api/messages", { sessionId: sid2, senderRole: "VICTIM", senderName: vNameF, content: "مرحباً دكتور، أنا في انتظارك" });
    ok("رسالة: أُرسلت عبر REST", msg1.data.ok === true);
    await wait(1200);
    const cNotifsAfter = await (await fetch(`${BASE}/api/notifications?userId=${seeded.userId}`)).json();
    const afterMsg = (cNotifsAfter.notifications || []).filter((n) => n.key === "message").length;
    ok("رسالة: الطرف الغائب تلقى إشعاراً داخلياً", afterMsg === beforeMsg + 1);

    /* الطرف حاضر الآن (نبض ثم رسالة فوراً) → لا إشعار جديد */
    await post(`/api/sessions/${sid2}/presence`, { role: "COUNSELOR" });
    await post("/api/messages", { sessionId: sid2, senderRole: "VICTIM", senderName: vNameF, content: "هل تسمعني الآن؟" });
    await wait(1200);
    const cNotifsAfter2 = await (await fetch(`${BASE}/api/notifications?userId=${seeded.userId}`)).json();
    const afterMsg2 = (cNotifsAfter2.notifications || []).filter((n) => n.key === "message").length;
    ok("رسالة: الطرف الحاضر لا يتلقى إشعاراً جديداً", afterMsg2 === afterMsg);

    /* ─── 7) تذكير قبل ساعة ─── */
    const vNotifs0 = await (await fetch(`${BASE}/api/notifications?userId=${victimId}`)).json();
    const vReminders0 = (vNotifs0.notifications || []).filter((n) => n.key === "reminder").length;
    /* استدعاء كسول: GET /api/sessions يشغّل sendDueReminders */
    await get(`/api/sessions?userId=${victimId}&role=VICTIM`);
    await get(`/api/sessions?userId=${seeded.userId}&role=COUNSELOR`);
    await wait(2000);
    const vNotifs1 = await (await fetch(`${BASE}/api/notifications?userId=${victimId}`)).json();
    const cNotifs1 = await (await fetch(`${BASE}/api/notifications?userId=${seeded.userId}`)).json();
    const vRem = (vNotifs1.notifications || []).filter((n) => n.key === "reminder").length;
    const cRem = (cNotifs1.notifications || []).filter((n) => n.key === "reminder").length;
    ok("تذكير: المتضرر تلقى تذكير الجلسة بعد ساعة", vRem === vReminders0 + 1);
    ok("تذكير: الأخصائي تلقى التذكير أيضاً", cRem >= 1);
    /* عدم تكرار التذكير */
    await get(`/api/sessions?userId=${victimId}&role=VICTIM`);
    await wait(1500);
    const vNotifs2 = await (await fetch(`${BASE}/api/notifications?userId=${victimId}`)).json();
    const vRem2 = (vNotifs2.notifications || []).filter((n) => n.key === "reminder").length;
    ok("تذكير: لا تكرار عند الدورات التالية", vRem2 === vRem);

    /* ─── 8) إنشاء الجلسة تلقائياً من موعد المتابعة ─── */
    const inWeek = new Date(Date.now() + 7 * 86400000).toISOString();
    const vNotifsBeforeFu = await (await fetch(`${BASE}/api/notifications?userId=${victimId}`)).json();
    const vFu0 = (vNotifsBeforeFu.notifications || []).filter((n) => n.key === "followUp").length;
    /* إنهاء الجلسة (المتضرر) */
    const end = await patch2(`/api/sessions/${sid}`, { status: "COMPLETED" });
    ok("إنهاء الجلسة من الطرفين", end.data.ok === true && end.data.session.status === "COMPLETED");

    const fu = await patch2(`/api/sessions/${sid}`, { followUpAt: inWeek });
    ok("المتابعة: الجلسة القادمة أُنشئت تلقائياً", fu.data.ok === true && !!fu.data.followUpCreated && fu.data.followUpCreated !== sid);
    const fuId = fu.data.followUpCreated;
    const fuGet = await get(`/api/sessions/${fuId}`);
    ok("المتابعة: التفاصيل صحيحة (طرفان + موعد + مقبولة)", fuGet.data.session?.status === "ACCEPTED"
      && fuGet.data.session?.victim?.id === victimId
      && fuGet.data.session?.counselor?.id === seeded.userId
      && Math.abs(new Date(fuGet.data.session.scheduledAt).getTime() - new Date(inWeek).getTime()) < 1000);

    await wait(1200);
    const vNotifsAfterFu = await (await fetch(`${BASE}/api/notifications?userId=${victimId}`)).json();
    const vFu1 = (vNotifsAfterFu.notifications || []).filter((n) => n.key === "followUp").length;
    ok("المتابعة: إشعار followUp للمتضرر", vFu1 === vFu0 + 1);

    /* ─── 9) العدّاد الحيّ بعد جلسة مكتملة ─── */
    const list3 = await (await fetch(`${BASE}/api/counselors`)).json();
    const seeded3 = (list3.counselors || []).find((c) => c.fullName === "د. تجربة");
    ok("العدّاد الحيّ: جلسة مكتملة واحدة بعد إنهائها", seeded3?.sessionsCount === 1);

    /* ─── 10) غرفة الجلسة ترجع الحقول الجديدة ─── */
    ok("الجلسة: تُعرض حقول الحضور والتذكير", fuGet.data.session && "victimLastSeenAt" in fuGet.data.session && "counselorLastSeenAt" in fuGet.data.session && "reminderSentAt" in fuGet.data.session);
  } finally {
    server.kill("SIGTERM");
    await wait(500);
    await mongod.stop();
  }

  console.log("\n══════════════════════════════════");
  if (fails === 0) console.log("🎉 كل اختبارات v2.5.1 نجحت");
  else console.log(`⚠️  ${fails} اختبار فاشل`);
  process.exit(fails === 0 ? 0 : 1);
}

const patch2 = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    return { status: r.status, data: await r.json() };
  } catch {
    return { status: r.status, data: {} };
  }
};

main().catch((e) => {
  console.error("❌ فشل سكربت الاختبار:", e.message);
  process.exit(1);
});
