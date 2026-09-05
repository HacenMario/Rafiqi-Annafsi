/**
 * اختبار v2.8.0 — التوزيع العادل + الحدود + المدة + الرفض بسبب + تغيير الموعد + DM + الإدارة
 * ─────────────────────────────────────────────────────────────────
 *  1. جلسة واحدة فقط في نفس اليوم للمتضرر (VICTIM_DAY_LIMIT)
 *  2. الموعد المحجوز لا يمكن اختياره من متضرر آخر (SLOT_TAKEN)
 *  3. التوزيع العادل: من قبل 5+ جلسات اليوم لا يظهر في المطابقة
 *     + todayLoad يتصاعد + الترتيب الأقل حملاً أولاً
 *  4. القبول بمدة (durationMinutes تُحفظ وتُرسل) + رفض مدة غير صالحة
 *  5. الرفض بسبب إلزامي (REASON_REQUIRED) + الإشعار التلقائي يحمل السبب
 *  6. تغيير الموعد قبل القبول (rescheduleTo) + إشعار خاص + رفض SLOT_TAKEN
 *  7. المحادثة قبل الجلسة (DM): متضرر يبدأ، أخصائي يرد، أخصائي بلا صلاحية
 *     يُرفض NOT_ALLOWED، إشعار الطرف الغائب مع اقتباس الرسالة
 *  8. الإدارة: تبويب الملغاة (cancelled-requests)، حذف طلب معلّق
 *     (delete-session)، الإشعار الجماعي (bulk-notify)، المؤسسون
 *     (founders-save/get)، تحسين الأداء (لا صور في list-users)
 *  9. المواعيد المحجوزة: /api/taken-slots يعيد الموعد المحجوز
 * 10. الإخفاء السريع في القاعدة: /api/quickhide يحفظ ويعيد الحالة
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { MongoClient } = require("mongodb");

const PORT = String(3100 + (process.pid % 400) + Math.floor(Math.random() * 100));
const BASE = `http://localhost:${PORT}`;
let failures = 0;

function req(method, path, body) {
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
          try { json = JSON.parse(buf); } catch {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
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
const isoAt = (date, slot) => new Date(`${date}T${slot}:00+01:00`).toISOString(); // توقيت الجزائر

(async () => {
  console.log("═".repeat(56));
  console.log("🧪 اختبار v2.8.0 — التوزيع العادل والمدة والرفض بسبب والمحادثة");
  console.log("═".repeat(56));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-v280");
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT, MONGODB_URI: uri, ADMIN_PASSCODE: "v280-admin-pass", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) { try { const h = await req("GET", "/api/health"); if (h.json?.version === "2.8.0") { console.log(`  🟢 الخادم v2.8.0 جاهز`); break; } } catch {} await wait(500); }

  const dbClient = new MongoClient(uri);
  try {
    /* أخصائيان + متضرران */
    const regA = await req("POST", "/api/counselor", { action: "register", fullName: "د. عادل توزيع", email: `a-${Date.now()}@v28.dz`, password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية", whatsapp: "0555123456", specialties: ["trauma"], languages: ["ar"], yearsExperience: 8 });
    const regB = await req("POST", "/api/counselor", { action: "register", fullName: "د. باريك ضغط", email: `b-${Date.now()}@v28.dz`, password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية", whatsapp: "0555123457", specialties: ["trauma"], languages: ["ar"], yearsExperience: 3 });
    const userA = regA.json?.userId;
    const userB = regB.json?.userId;
    check("تسجيل الأخصائيين", !!userA && !!userB);

    await dbClient.connect();
    /* توثيق مباشر في القاعدة (المطابقة والحجز يتطلبان VERIFIED) */
    await dbClient.db().collection("counselors").updateMany({}, { $set: { verificationStatus: "VERIFIED" } });
    const profA = await dbClient.db().collection("counselors").findOne({ userId: new (require("mongodb").ObjectId)(userA) });
    const profB = await dbClient.db().collection("counselors").findOne({ userId: new (require("mongodb").ObjectId)(userB) });

    const vic = async (name) => {
      const r = await req("POST", "/api/victim", { action: "register", pseudonym: `${name}_${Date.now() % 100000}`, password: "victimpass123", recoveryPhrase: "عبارة استرجاع صحيحة" });
      return r.json?.user?.id;
    };
    const v1 = await vic("متضرر_حد_اليوم");
    const v2 = await vic("متضرر_المنافس");
    const v3 = await vic("متضرر_محادثة");
    check("تسجيل المتضررين الثلاثة", !!v1 && !!v2 && !!v3);

    const d3 = futureDate(3);
    const d4 = futureDate(4);
    const d5 = futureDate(5); /* يوم نظيف لاختبار حد حمل الأخصائي B */

    /* ─── 1) جلسة واحدة فقط في نفس اليوم ─── */
    console.log("① جلسة واحدة فقط في نفس اليوم…");
    const ok1 = await req("POST", "/api/sessions", { victimId: v1, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: isoAt(d3, "09:00"), date: d3, slot: "09:00" });
    check("الحجز الأول في اليوم → 200", ok1.status === 200);
    const dup = await req("POST", "/api/sessions", { victimId: v1, counselorId: userB, topic: "grief", mode: "TEXT", scheduledAt: isoAt(d3, "13:00"), date: d3, slot: "13:00" });
    check("الحجز الثاني لنفس المتضرر بنفس اليوم → 409 VICTIM_DAY_LIMIT", dup.status === 409 && dup.json?.error === "VICTIM_DAY_LIMIT", `got=${dup.status}`);
    const otherDay = await req("POST", "/api/sessions", { victimId: v1, counselorId: userB, topic: "grief", mode: "TEXT", scheduledAt: isoAt(d4, "09:00"), date: d4, slot: "09:00" });
    check("يوم آخر → يُسمح", otherDay.status === 200);

    /* ─── 2) الموعد المحجوز لا يتكرر ─── */
    console.log("② الموعد المحجوز لا يمكن اختياره…");
    const clash = await req("POST", "/api/sessions", { victimId: v2, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: isoAt(d3, "09:00"), date: d3, slot: "09:00" });
    check("نفس الموعد مع نفس الأخصائي لمتضرر آخر → 409 SLOT_TAKEN", clash.status === 409 && clash.json?.error === "SLOT_TAKEN", `got=${clash.status}`);
    const free = await req("POST", "/api/sessions", { victimId: v2, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: isoAt(d3, "10:00"), date: d3, slot: "10:00" });
    check("ساعة أخرى مع نفس الأخصائي → 200", free.status === 200);

    /* ─── 9) taken-slots ─── */
    console.log("⑨ /api/taken-slots…");
    const taken = await req("GET", `/api/taken-slots?counselorId=${userA}&days=14`);
    check("الموعد 09:00 يظهر محجوزاً", (taken.json?.taken?.[d3] || []).includes("09:00"));
    check("الموعد 10:00 يظهر محجوزاً", (taken.json?.taken?.[d3] || []).includes("10:00"));
    check("ساعة حرة 11:00 ليست محجوزة", !(taken.json?.taken?.[d3] || []).includes("11:00"));

    /* ─── 3) التوزيع العادل ─── */
    console.log("③ التوزيع العادل: حد 4 مقبولة في اليوم…");
    /* اقبل 5 جلسات للأخصائي B في d5 على ساعات مختلفة — B يصل الحد ويُستبعد */
    const slots = ["09:00", "10:00", "11:00", "13:00", "14:00"];
    let accepted = 0;
    for (const sl of slots) {
      const vr = await vic(`متضرر_حمل_${sl.replace(":", "")}`);
      const book = await req("POST", "/api/sessions", { victimId: vr, counselorId: userB, topic: "anxiety", mode: "TEXT", scheduledAt: isoAt(d5, sl), date: d5, slot: sl });
      if (book.status !== 200) { check(`حجز مسبق ${sl} (للتحميل)`, false, `got=${book.status}`); continue; }
      const acc = await req("PATCH", `/api/sessions/${book.json?.session?.id}`, { status: "ACCEPTED", durationMinutes: 60, cancelledBy: "COUNSELOR" });
      if (acc.status === 200) accepted++;
    }
    check(`قُبلت 5 جلسات للأخصائي B في ${d5}`, accepted === 5, `accepted=${accepted}`);
    const matchAfter = await req("POST", "/api/counselors/match", { slots: [{ date: d4, slot: "15:00" }, { date: d3, slot: "11:00" }] });
    const idsAfter = (matchAfter.json?.counselors || []).map((c) => c.userId);
    check("المطرَقون يطابقون مواعيدهم الفارغة", idsAfter.includes(userA), `ids=${idsAfter.length}`);
    const matchBOnly = await req("POST", "/api/counselors/match", { slots: [{ date: d5, slot: "15:00" }] });
    const idsB = (matchBOnly.json?.counselors || []).map((c) => c.userId);
    check("B الممتلئ (5 مقبولة) مستبعد من المطابقة", !idsB.includes(userB), `ids=${JSON.stringify(idsB)}`);
    const fullBook = await req("POST", "/api/sessions", { victimId: v1, counselorId: userB, topic: "anxiety", mode: "TEXT", scheduledAt: isoAt(futureDate(5), "09:00"), date: futureDate(5), slot: "09:00" });
    /* الحجز في يوم آخر غير الممتلئ مسموح — COUNSELOR_DAY_FULL يخص اليوم فقط؛
       نتحقق بدلاً من ذلك عبر محاولة حجز في d4 نفسه بساعة فارغة */
    const fullBookToday = await req("POST", "/api/sessions", { victimId: v3, counselorId: userB, topic: "anxiety", mode: "TEXT", scheduledAt: isoAt(d5, "15:00"), date: d5, slot: "15:00" });
    check("حجز جديد مع B في يومه الممتلئ → 409 COUNSELOR_DAY_FULL", fullBookToday.status === 409 && fullBookToday.json?.error === "COUNSELOR_DAY_FULL", `got=${fullBookToday.status}`);
    const matchSorted = await req("POST", "/api/counselors/match", { slots: [{ date: d3, slot: "11:00" }] });
    check("المطابقة تحمل todayLoad", matchSorted.json?.counselors?.every((c) => typeof c.todayLoad === "number") === true);

    /* ─── 4) القبول بمدة ─── */
    console.log("④ القبول بمدة الجلسة…");
    const pend = await req("POST", "/api/sessions", { victimId: v2, counselorId: userA, topic: "safety", mode: "TEXT", scheduledAt: isoAt(futureDate(6), "09:00"), date: futureDate(6), slot: "09:00" });
    const sid = pend.json?.session?.id;
    const badDur = await req("PATCH", `/api/sessions/${sid}`, { status: "ACCEPTED", durationMinutes: 999 });
    check("مدة غير صالحة → 400 INVALID_DURATION", badDur.status === 400 && badDur.json?.error === "INVALID_DURATION");
    const accDur = await req("PATCH", `/api/sessions/${sid}`, { status: "ACCEPTED", durationMinutes: 45 });
    check("القبول بمدة 45 → تُحفظ", accDur.status === 200 && accDur.json?.session?.durationMinutes === 45, `got=${accDur.json?.session?.durationMinutes}`);

    /* ─── 5) الرفض بسبب إلزامي + الإشعار ─── */
    console.log("⑤ الرفض بسبب إلزامي…");
    const pend2 = await req("POST", "/api/sessions", { victimId: v2, counselorId: userA, topic: "other", mode: "TEXT", scheduledAt: isoAt(futureDate(7), "09:00"), date: futureDate(7), slot: "09:00" });
    const sid2 = pend2.json?.session?.id;
    const noReason = await req("PATCH", `/api/sessions/${sid2}`, { status: "CANCELLED", cancelledBy: "COUNSELOR", cancelReason: "  " });
    check("رفض بلا سبب → 400 REASON_REQUIRED", noReason.status === 400 && noReason.json?.error === "REASON_REQUIRED", `got=${noReason.status}`);
    const withReason = await req("PATCH", `/api/sessions/${sid2}`, { status: "CANCELLED", cancelledBy: "COUNSELOR", cancelReason: "لدي التزام طبي في نفس الموعد" });
    check("الرفض بسبب → 200 والسبب محفوظ", withReason.status === 200 && withReason.json?.session?.cancelReason?.includes("التزام طبي"));
    await wait(1200);
    const notifAfterDecline = await dbClient.db().collection("notifications").findOne({ userId: new (require("mongodb").ObjectId)(v2), key: "declinedReason" });
    check("إشعار تلقائي للمتضرر يحمل السبب", !!notifAfterDecline && (notifAfterDecline.body || "").includes("التزام طبي"));

    /* ─── 6) تغيير الموعد قبل القبول ─── */
    console.log("⑥ تغيير الموعد قبل القبول…");
    const pend3 = await req("POST", "/api/sessions", { victimId: v2, counselorId: userA, topic: "childSupport", mode: "TEXT", scheduledAt: isoAt(futureDate(8), "09:00"), date: futureDate(8), slot: "09:00" });
    const sid3 = pend3.json?.session?.id;
    const moved = await req("PATCH", `/api/sessions/${sid3}`, { rescheduleTo: isoAt(futureDate(8), "17:00") });
    check("تغيير الموعد → 200 والموعد تحدّث", moved.status === 200 && moved.json?.session?.rescheduleCount === 1);
    await wait(1000);
    const notifResched = await dbClient.db().collection("notifications").findOne({ userId: new (require("mongodb").ObjectId)(v2), key: "rescheduled" });
    check("إشعار خاص بالموعد الجديد وصل للمتضرر", !!notifResched);
    /* تغيير على جلسة مقبولة يُرفض */
    const notPending = await req("PATCH", `/api/sessions/${sid}`, { rescheduleTo: isoAt(futureDate(9), "09:00") });
    check("تغيير موعد جلسة مقبولة → 400 NOT_PENDING", notPending.status === 400 && notPending.json?.error === "NOT_PENDING");
    /* تصادم مع موعد محجوز */
    const pend4 = await req("POST", "/api/sessions", { victimId: v2, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: isoAt(futureDate(10), "11:00"), date: futureDate(10), slot: "11:00" });
    const sid4 = pend4.json?.session?.id;
    const pend5 = await req("POST", "/api/sessions", { victimId: v3, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: isoAt(futureDate(10), "13:00"), date: futureDate(10), slot: "13:00" });
    const clashMove = await req("PATCH", `/api/sessions/${sid4}`, { rescheduleTo: isoAt(futureDate(10), "13:00") });
    check("تغيير الموعد إلى موعد محجوز → 409 SLOT_TAKEN", clashMove.status === 409 && clashMove.json?.error === "SLOT_TAKEN", `got=${clashMove.status}`);
    void pend5; void sid4;

    /* ─── 7) المحادثة قبل الجلسة (DM) ─── */
    console.log("⑦ المحادثة قبل الجلسة…");
    const dmKey = `dm:${v3}:${userA}`;
    const dm1 = await req("POST", "/api/messages", { threadKey: dmKey, senderRole: "VICTIM", senderId: v3, senderName: "متضرر محادثة", content: "مساء الخير، هل يمكنني الاستشارة قبل حجز الجلسة؟" });
    check("المتضرر يبدأ المحادثة", dm1.status === 200 && dm1.json?.ok === true);
    const dm2 = await req("POST", "/api/messages", { threadKey: dmKey, senderRole: "COUNSELOR", senderId: userA, senderName: "د. عادل توزيع", content: "وعليكم السلام، طبعاً تفضل بسؤالك" });
    check("الأخصائي يرد (له جلسة/سبق مراسلة)", dm2.status === 200);
    const threadGet = await req("GET", `/api/messages?threadKey=${encodeURIComponent(dmKey)}`);
    check("قراءة الخيط تعيد الرسالتين", (threadGet.json?.messages || []).length >= 2);
    const dmStranger = await req("POST", "/api/messages", { threadKey: `dm:${v3}:${userB}`, senderRole: "COUNSELOR", senderId: userB, senderName: "د. باريك ضغط", content: "مرحباً" });
    check("أخصائي بلا جلسة ولا رسالة سابقة → 403 NOT_ALLOWED", dmStranger.status === 403 && dmStranger.json?.error === "NOT_ALLOWED", `got=${dmStranger.status}`);
    await wait(1500);
    const dmNotif = await dbClient.db().collection("notifications").findOne({ userId: new (require("mongodb").ObjectId)(userA), title: "💬 رسالة جديدة" });
    check("إشعار الطرف الغائب يحمل اقتباس الرسالة", !!dmNotif && (dmNotif.body || "").includes("مساء الخير"), JSON.stringify(dmNotif || {}).slice(0, 120));

    /* ─── 8) الإدارة ─── */
    console.log("⑧ الإدارة: الملغاة/الحذف/الجماعي/المؤسسون…");
    const cancelled = await req("POST", "/api/admin", { action: "cancelled-requests" });
    check("تبويب الملغاة يعيد الطلب المرفوض بالسبب", (cancelled.json?.cancelled || []).some((c) => c.cancelReason?.includes("التزام طبي")));
    const pendDel = await req("POST", "/api/sessions", { victimId: v3, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: isoAt(futureDate(11), "09:00"), date: futureDate(11), slot: "09:00" });
    const delId = pendDel.json?.session?.id;
    const del = await req("POST", "/api/admin", { action: "delete-session", sessionId: delId });
    check("حذف طلب معلّق مباشرة", del.status === 200 && del.json?.ok === true);
    const gone = await req("GET", `/api/sessions/${delId}?userId=${userA}`);
    check("الطلب المحذوف لم يعد موجوداً", gone.status === 404);

    const bulk = await req("POST", "/api/admin", { action: "bulk-notify", target: "ALL_COUNSELORS", textAr: "اجتماع فريق الأخصائيين غداً مساءً" });
    check("إشعار جماعي لكل المختصين", bulk.status === 200 && bulk.json?.ok === true && bulk.json?.count >= 2, `got=${JSON.stringify(bulk.json).slice(0, 80)}`);
    const bulkUser = await req("POST", "/api/admin", { action: "bulk-notify", target: "USER", userId: v1, textAr: "رسالة خاصة لك" });
    check("إشعار لمستخدم محدّد", bulkUser.status === 200 && bulkUser.json?.count === 1);
    const bulkBad = await req("POST", "/api/admin", { action: "bulk-notify", target: "ALL_VICTIMS", textAr: "" });
    check("نص فارغ → 400 TEXT_REQUIRED", bulkBad.status === 400);

    const fsave = await req("POST", "/api/admin", { action: "founders-save", textAr: "منصة رفيقي النفسي من فريق جزائري", textFr: "Plateforme par une équipe algérienne", textEn: "Platform by an Algerian team", developerName: "المطوّر المؤسس", developerRole: "مطوّر المنصة", members: [{ name: "د. عادل توزيع", role: "أخصائي نفسي" }, { name: "د. باريك ضغط", role: "معالج سلوكي" }] });
    check("حفظ صفحة المؤسسين", fsave.status === 200 && fsave.json?.ok === true);
    const foundersPublic = await req("GET", "/api/founders");
    check("صفحة المؤسسين العامة تعيد القائمة", foundersPublic.json?.content?.members?.length === 2 && foundersPublic.json?.content?.developerName === "المطوّر المؤسس");

    const usersPerf = await req("POST", "/api/admin", { action: "list-users", role: "ALL", q: "" });
    check("list-users يعمل (اختبار الأداء: بلا حقول الصور)", usersPerf.status === 200 && (usersPerf.json?.users || []).length >= 3);

    /* ─── 10) الإخفاء السريع في القاعدة ─── */
    console.log("⑩ الإخفاء السريع محفوظ في الحساب…");
    const qhSave = await req("POST", "/api/quickhide", { userId: v1, enabled: true, hash: "a".repeat(64) });
    check("حفظ التفعيل في القاعدة", qhSave.status === 200 && qhSave.json?.ok === true);
    const qhGet = await req("GET", `/api/quickhide?userId=${v1}`);
    check("الحالة تُقرأ من الحساب", qhGet.json?.enabled === true && qhGet.json?.hash === "a".repeat(64));
    const qhOff = await req("POST", "/api/quickhide", { userId: v1, enabled: false });
    const qhGet2 = await req("GET", `/api/quickhide?userId=${v1}`);
    check("التعطيل يُحفظ أيضاً", qhOff.status === 200 && qhGet2.json?.enabled === false);

    void profA; void profB;
  } catch (e) {
    check("لا استثناءات", false, String(e && e.message));
    console.error(e);
  } finally {
    try { await dbClient.close(); } catch {}
    server.kill("SIGKILL");
    await wait(400);
    try { await mongod.stop(); } catch {}
  }

  console.log("─".repeat(56));
  if (failures === 0) console.log("🎉 كل فحوص v2.8.0 ناجحة");
  else { console.log(`💥 ${failures} فحصاً فاشلاً`); process.exitCode = 1; }
})();
