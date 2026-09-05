/**
 * اختبار v2.6.0 — منطق الحجز الجديد + إدارة الطلبات المعلقة
 * ─────────────────────────────────────────────────────────────
 *  1. جدول التوفر الأسبوعي: حفظ + قراءة + تطبيع
 *  2. المطابقة (الخيار الأول): فقط الأخصائيون الذين يوفرون نفس الموعد
 *  3. الحجز: رفض SLOT_UNAVAILABLE خارج الجدول + قبول داخل الجدول
 *     + الأخصائي غير المخصّص يقبل كل المواعيد (استمرارية v2.5)
 *  4. طلبات الأخصائي المعلقة في الأدمين (الاسم المستعار + تاريخ الإنشاء)
 *  5. المسح +36 ساعة: وسْم + عدّاد التأخر + إشعار الأدمين + تعليق تلقائي بعد 3
 *  6. التعليق: منع الولوج + الإخفاء من القوائم والمطابقة + التفعيل اليدوي يصفّر
 *  7. تفعيل/تعطيل المتضرر + حماية حسابات الإدارة من التعطيل
 *  8. انحدار: PAST_DATE ما زال مرفوضاً
 *
 * ملاحظة: V26_LAUNCH يُقرأ من البيئة — الاختبار يضبطه للأيام الخمسة الماضية
 * كي يمكن زرع طلبات متأخرة اصطناعياً واختبار المسح كاملاً.
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { MongoClient } = require("mongodb");

const PORT = String(3100 + (process.pid % 400) + Math.floor(Math.random() * 100));
const BASE = `http://localhost:${PORT}`;
let failures = 0;

async function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(buf); } catch { /* HTML */ }
          resolve({ status: res.statusCode, json, text: buf });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function check(name, cond, detail = "") {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name} ${detail}`);
  }
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await req("GET", "/api/health");
      if (r.status === 200) return true;
    } catch { /* not yet */ }
    await wait(800);
  }
  return false;
}

/* تاريخ مستقبلي آمن بيومين وساعة 09:00 — يتفادى PAST_DATE مهما كانت اللحظة */
function futureDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  console.log("🧪 اختبار v2.6.0 — منطق الحجز الجديد");
  console.log("─".repeat(56));

  const mongod = await MongoMemoryServer.create({ instance: { port: 27140, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");

  /* V26_LAUNCH = خمسة أيام ماضية — ليزرع الاختبار طلبات «متأخرة 40 ساعة» */
  const launchOverride = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: PORT,
      MONGODB_URI: uri,
      NODE_ENV: "production",
      ADMIN_PASSCODE: "rafiqi-admin-2026",
      V26_LAUNCH: launchOverride,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write(`   [srv] ${d}`));
  server.stderr.on("data", (d) => process.stdout.write(`   [err] ${d}`));

  const dbClient = new MongoClient(uri);

  try {
    check("الخادم يستجيب", await waitForServer());

    /* ─── تجهيز: أخصائيان موثّقان + متضرران ─── */
    console.log("① تجهيز الحسابات…");
    const emailA = `dr-a-${Date.now()}@rafiqi.dz`;
    const regA = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "د. الأمين تجريبي",
      email: emailA,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555123456",
      specialties: ["trauma"],
      languages: ["ar", "fr"],
      yearsExperience: 5,
    });
    const userA = regA.json?.userId;
    const meA = await req("GET", `/api/counselor?userId=${userA}`);
    const profileIdA = meA.json?.profile?.id;
    await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
    await req("POST", "/api/admin", { action: "verify", profileId: profileIdA });
    check("الأخصائي A موثّق", !!userA && !!profileIdA);

    const regB = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "د. بلال تجريبي",
      email: `dr-b-${Date.now()}@rafiqi.dz`,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555987654",
      specialties: ["grief"],
      languages: ["ar"],
      yearsExperience: 3,
    });
    const userB = regB.json?.userId;
    const meB = await req("GET", `/api/counselor?userId=${userB}`);
    await req("POST", "/api/admin", { action: "verify", profileId: meB.json?.profile?.id });
    check("الأخصائي B موثّق (بلا جدول — استمرارية)", !!userB);

    const vic1 = await req("POST", "/api/victim", { action: "register", pseudonym: `متضرر1_${Date.now() % 100000}`, password: "victimpass123", recoveryPhrase: "عبارة استرجاع" });
    const victim1 = vic1.json?.user?.id;
    const vic2 = await req("POST", "/api/victim", { action: "register", pseudonym: `متضرر2_${Date.now() % 100000}`, password: "victimpass123", recoveryPhrase: "عبارة استرجاع" });
    const victim2 = vic2.json?.user?.id;
    const victim2Alias = vic2.json?.user?.pseudonym;
    check("المتضرران جاهزان", !!victim1 && !!victim2);

    /* ─── 1) جدول التوفر ─── */
    console.log("② جدول التوفر الأسبوعي (حفظ/قراءة)…");
    const grid = {};
    for (let d = 0; d < 7; d++) grid[String(d)] = ["09:00", "10:00"];
    const saveAv = await req("POST", "/api/counselor", { action: "set-availability", userId: userA, weeklyAvailability: grid });
    check("حفظ الجدول → ok + مطابق", saveAv.status === 200 && saveAv.json?.ok && saveAv.json?.weeklyAvailability?.["0"]?.length === 2);

    const badGrid = { "0": ["08:00", "09:00"], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
    const badSave = await req("POST", "/api/counselor", { action: "set-availability", userId: userA, weeklyAvailability: badGrid });
    check("ساعة خارج SLOT_TIMES تُنقّى (08:00 تُرفض)", badSave.json?.weeklyAvailability?.["0"]?.length === 1 && !badSave.json?.weeklyAvailability?.["0"]?.includes("08:00"));

    const meAfter = await req("GET", `/api/counselor?userId=${userA}`);
    check("الجدول يُقرأ من الملف الخفيف", meAfter.json?.profile?.weeklyAvailability?.["0"]?.includes("09:00"));

    /* الجدول الفارغ تماماً → null (كل الأوقات) */
    const emptyGrid = {};
    for (let d = 0; d < 7; d++) emptyGrid[String(d)] = [];
    const emptySave = await req("POST", "/api/counselor", { action: "set-availability", userId: userA, weeklyAvailability: emptyGrid });
    check("الجدول الفارغ → null (كل الأوقات)", emptySave.json?.weeklyAvailability === null);
    /* نعيد الجدول الحقيقي */
    await req("POST", "/api/counselor", { action: "set-availability", userId: userA, weeklyAvailability: grid });

    /* قائمة الأخصائيين تحمل weeklyAvailability */
    const list = await req("GET", "/api/counselors");
    const cardA = (list.json?.counselors || []).find((c) => c.userId === userA);
    const cardB = (list.json?.counselors || []).find((c) => c.userId === userB);
    check("القائمة: جدول A ظاهر و B بلا جدول", cardA?.weeklyAvailability?.["0"]?.length === 2 && cardB?.weeklyAvailability === null);

    /* ─── 2) المطابقة (الخيار الأول) ─── */
    console.log("③ المطابقة: فقط من يوفر نفس الموعد…");
    const date2 = futureDate(2);
    const matchBoth = await req("POST", "/api/counselors/match", { slots: [{ date: date2, slot: "09:00" }] });
    const ids09 = (matchBoth.json?.counselors || []).map((c) => c.userId);
    check("09:00 → A و B كلاهما (B غير المخصّص يطابق الكل)", ids09.includes(userA) && ids09.includes(userB));

    const matchB = await req("POST", "/api/counselors/match", { slots: [{ date: date2, slot: "13:00" }] });
    const ids13 = (matchB.json?.counselors || []).map((c) => c.userId);
    check("13:00 → B فقط (A لا يوفره)", ids13.includes(userB) && !ids13.includes(userA));
    check("A المُطابَق يحمل matchedSlots صحيحة", (matchBoth.json?.counselors || []).find((c) => c.userId === userA)?.matchedSlots?.[0]?.slot === "09:00");

    /* ─── 3) الحجز: تحقق الخادم من الجدول ─── */
    console.log("④ الحجز: SLOT_UNAVAILABLE خارج الجدول…");
    const badBook = await req("POST", "/api/sessions", { victimId: victim1, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: new Date(`${date2}T09:00:00`).toISOString(), date: date2, slot: "13:00" });
    check("حجز A في 13:00 → 400 SLOT_UNAVAILABLE", badBook.status === 400 && badBook.json?.error === "SLOT_UNAVAILABLE", JSON.stringify(badBook.json));

    const goodBook = await req("POST", "/api/sessions", { victimId: victim1, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: new Date(`${date2}T09:00:00`).toISOString(), date: date2, slot: "09:00" });
    check("حجز A في 09:00 → 200", goodBook.status === 200 && !!goodBook.json?.session?.id);

    /* v2.8.0: جلسة واحدة فقط في نفس اليوم للمتضرر — نفس المتضرر لا يحجز مرتين في date2
       (كان الاختبار يسمح بحجزين في نفس اليوم قبل سياسة v2.8.0) */
    const freeBook = await req("POST", "/api/sessions", { victimId: victim1, counselorId: userB, topic: "anxiety", mode: "TEXT", scheduledAt: new Date(`${date2}T13:00:00`).toISOString(), date: date2, slot: "13:00" });
    check("حجز ثانٍ لنفس المتضرر في نفس اليوم → 409 VICTIM_DAY_LIMIT (v2.8.0)", freeBook.status === 409 && freeBook.json?.error === "VICTIM_DAY_LIMIT", `got=${freeBook.status} ${JSON.stringify(freeBook.json).slice(0, 80)}`);

    /* انحدار v2.5.4: PAST_DATE */
    const pastBook = await req("POST", "/api/sessions", { victimId: victim1, counselorId: userB, topic: "grief", mode: "TEXT", scheduledAt: new Date(Date.now() - 86400000).toISOString(), date: futureDate(-2), slot: "09:00" });
    check("انحدار: حجز فائت → 400 PAST_DATE", pastBook.status === 400 && pastBook.json?.error === "PAST_DATE");

    /* ─── 4) طلبات الأخصائي المعلقة (الأدمين) ─── */
    console.log("⑤ نافذة الطلبات المعلقة للأخصائي في الأدمين…");
    const reqs = await req("POST", "/api/admin", { action: "counselor-requests", counselorUserId: userA });
    const reqRow = (reqs.json?.requests || [])[0];
    check("طلب A المعلق ظاهر بالاسم المستعار", reqs.status === 200 && reqRow?.victimAlias?.startsWith("متضرر1"));
    check("تاريخ الإنشاء بصيغة ISO كاملة (يُعرض YYYY/MM/DD HH:MM:SS)", !!reqRow?.createdAt && /\d{4}-\d{2}-\d{2}T/.test(reqRow.createdAt));
    check("تفاصيل الطلب: الموضوع والوسيط والموعد", reqRow?.topic === "grief" && reqRow?.mode === "TEXT" && !!reqRow?.scheduledAt);

    /* ─── 5+6) المسح +36 ساعة: عدّاد + إشعار + تعليق تلقائي ─── */
    console.log("⑥ المسح +36 ساعة: تأخرات، إشعار الأدمين، تعليق تلقائي…");
    await dbClient.connect();
    const db = dbClient.db("rafiqi-nafsi");

    /* مستخدم إدارة ليستقبل الإشعارات الداخلية */
    await db.collection("users").insertOne({ role: "ADMIN", language: "ar", pseudonym: "الإدارة", createdAt: new Date() });

    /* زرع 3 طلبات معلقة متأخرة 40 ساعة (ضمن نافذة الإطلاق المعدّلة) */
    const overdueAt = new Date(Date.now() - 40 * 60 * 60 * 1000);
    const futureSched = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 3; i++) {
      await db.collection("sessions").insertOne({
        victimId: new (require("mongodb").ObjectId)(victim2),
        counselorId: new (require("mongodb").ObjectId)(userA),
        topic: "safety",
        mode: "TEXT",
        scheduledAt: futureSched,
        status: "PENDING",
        source: null,
        lateFlagged: false,
        createdAt: overdueAt,
        updatedAt: overdueAt,
      });
    }

    const sweep1 = await req("POST", "/api/admin", { action: "overdue-requests" });
    const overdueList = sweep1.json?.overdue || [];
    check("اللافتة تعيد 3 طلبات متأخرة", overdueList.length === 3, `got ${overdueList.length}`);
    check("التفاصيل: المتضرر + الأخصائي + الساعات", overdueList[0]?.victimAlias?.startsWith("متضرر2") && overdueList[0]?.hoursPending >= 36);

    const lateProfile = await db.collection("counselors").findOne({ userId: new (require("mongodb").ObjectId)(userA) });
    check("عدّاد التأخر = 3", lateProfile?.lateCount === 3, `got ${lateProfile?.lateCount}`);

    const userADoc = await db.collection("users").findOne({ _id: new (require("mongodb").ObjectId)(userA) });
    check("تعليق تلقائي بعد 3 تأخرات", userADoc?.suspended === true);

    const adminNotifs = await db.collection("notifications").find({ key: { $in: ["overdueRequest", "counselorSuspended"] } }).toArray();
    /* v2.7.0: ولوج الأدمين ينشئ حساب أدمين حقيقي إن لم يوجد — قد يتضاعف عدد المستلمين */
    const adminCount = await db.collection("users").countDocuments({ role: "ADMIN" });
    check(`إشعارات الأدمين: 3 تأخر + 1 تعليق = 4 × ${adminCount} أدمين`, adminNotifs.length === 4 * Math.max(1, adminCount), `got ${adminNotifs.length} admins=${adminCount}`);
    check("إشعار التأخر يحمل تفاصيل (الأخصائي + التاريخ)", adminNotifs.some((n) => n.key === "overdueRequest" && n.body.includes("د. الأمين") && /\d{4}\/\d{2}\/\d{2}/.test(n.body)));

    /* المعلّق: لا ولوج + لا ظهور في القائمة ولا المطابقة */
    const suspendedLogin = await req("POST", "/api/counselor", { action: "login", email: emailA, password: "testpass1234" });
    check("ولوج الأخصائي المعلّق → 403 SUSPENDED", suspendedLogin.status === 403 && suspendedLogin.json?.error === "SUSPENDED");

    const listAfter = await req("GET", "/api/counselors");
    check("المعلّق مختفٍ من دليل الأخصائيين", !(listAfter.json?.counselors || []).some((c) => c.userId === userA));

    const matchAfter = await req("POST", "/api/counselors/match", { slots: [{ date: date2, slot: "09:00" }] });
    check("المعلّق مختفٍ من المطابقة", !(matchAfter.json?.counselors || []).some((c) => c.userId === userA));

    /* المسح مرة ثانية: لا مضاعفة للعدّاد (lateFlagged) */
    await req("POST", "/api/admin", { action: "overdue-requests" });
    const lateProfile2 = await db.collection("counselors").findOne({ userId: new (require("mongodb").ObjectId)(userA) });
    check("المسح المتكرر لا يضاعف التأخرات", lateProfile2?.lateCount === 3, `got ${lateProfile2?.lateCount}`);

    /* ─── 7) التفعيل اليدوي يصفّر العدّاد ويعيد الحساب ─── */
    console.log("⑦ التفعيل اليدوي من الأدمين…");
    const reactivate = await req("POST", "/api/admin", { action: "toggle-user", userId: userA, suspended: false });
    check("تفعيل A → ok", reactivate.status === 200 && reactivate.json?.ok);
    const lateProfile3 = await db.collection("counselors").findOne({ userId: new (require("mongodb").ObjectId)(userA) });
    check("التفعيل يصفّر عدّاد التأخر", lateProfile3?.lateCount === 0, `got ${lateProfile3?.lateCount}`);
    const relLogin = await req("POST", "/api/counselor", { action: "login", email: emailA, password: "testpass1234" });
    check("A يستطيع الولوج بعد التفعيل", relLogin.status === 200 && relLogin.json?.ok);

    const listBack = await req("GET", "/api/counselors");
    check("A عاد إلى دليل الأخصائيين", (listBack.json?.counselors || []).some((c) => c.userId === userA));

    /* تعطيل/تفعيل متضرر */
    const suspV = await req("POST", "/api/admin", { action: "toggle-user", userId: victim2, suspended: true });
    const v2Login = await req("POST", "/api/victim", { action: "login", pseudonym: victim2Alias, password: "victimpass123" });
    check("تعطيل متضرر → ولوجه مرفوض SUSPENDED", suspV.json?.ok && v2Login.status === 403 && v2Login.json?.error === "SUSPENDED");
    await req("POST", "/api/admin", { action: "toggle-user", userId: victim2, suspended: false });
    const v2LoginBack = await req("POST", "/api/victim", { action: "login", pseudonym: victim2Alias, password: "victimpass123" });
    check("تفعيل متضرر → يعود الولوج", v2LoginBack.status === 200 && v2LoginBack.json?.ok);

    /* حماية حساب الإدارة */
    const adminDoc = await db.collection("users").findOne({ role: "ADMIN" });
    const suspAdmin = await req("POST", "/api/admin", { action: "toggle-user", userId: String(adminDoc._id), suspended: true });
    check("تعطيل حساب الإدارة مرفوض", suspAdmin.status === 400 && suspAdmin.json?.error === "CANNOT_SUSPEND_ADMIN");

    /* ─── list-users يحمل الحقول الجديدة ─── */
    const lu = await req("POST", "/api/admin", { action: "list-users", role: "ALL", q: "" });
    const luA = (lu.json?.users || []).find((u) => u.id === userA);
    check("list-users: suspended + lateCount ظاهران", luA && typeof luA.suspended === "boolean" && typeof luA.lateCount === "number");

    console.log("─".repeat(56));
    if (failures === 0) console.log("🎉 كل اختبارات v2.6.0 ناجحة");
    else console.log(`⚠️ ${failures} اختبارات فاشلة`);
  } finally {
    await dbClient.close().catch(() => {});
    server.kill("SIGKILL");
    await mongod.stop().catch(() => {});
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("💥 فشل غير متوقع:", e);
  process.exit(1);
});
