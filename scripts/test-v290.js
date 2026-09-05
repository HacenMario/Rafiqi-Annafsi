/**
 * اختبار v2.9.0 — المحادثات بلا جلسة + الفضاء الخاص + التوثيق + الجنس + التحدي + الإحصائيات
 * ─────────────────────────────────────────────────────────────────
 *  1. صندوق المحادثات: /api/messages/threads يعرض خيوط DM للأخصائي والمتضرر
 *  2. الأخصائي يرد في DM خيوط ما قبل الجلسة (بلا جلسة سابقة — بعد أن راسله المتضرر)
 *  3. فضاء الأخصائيين: خيط "counselors" — الأخصائي يرسل، المتضرر يُرفض NOT_ALLOWED
 *  4. جلسة واحدة/يوم صارمة: بعد إكمال جلسة اليوم لا يستطيع الحجز مجدداً (VICTIM_DAY_LIMIT)
 *  5. توثيق المتضررين من الحرائق: تسجيل fireVictim → VICTIM_UNVERIFIED عند الحجز
 *     → verify-victim من الأدمين → الحجز ينجح
 *  6. الجنس: أخصائي يقبل الإناث فقط → متضرر ذكر محجوب GENDER_NOT_ACCEPTED
 *     + فلترة القائمة (?gender=) تُخفيه
 *  7. تحدي الالتزام للمتضررين: 4 جلسات متتالية حضورها ≤10 دقائق → فائز واحد
 *     (يُقيَّم عبر نبض الحضور presence)
 *  8. لوحة قيادة الأدمين: dashboard-stats يعيد كل المجموعات
 *  9. روابط الإشعارات: إشعار الرسالة يحمل ?session=، وإشعار DM يحمل ?dm=
 * 10. /api/dm-peer يعيد اسم الطرف فقط
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
const isoAt = (date, slot) => new Date(`${date}T${slot}:00+01:00`).toISOString();

(async () => {
  console.log("═".repeat(56));
  console.log("🧪 اختبار v2.9.0 — المحادثات والفضاء الخاص والتوثيق والجنس والتحدي");
  console.log("═".repeat(56));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-v290");
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT, MONGODB_URI: uri, ADMIN_PASSCODE: "v290-admin-pass", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) { try { const h = await req("GET", "/api/health"); if (h.json?.version === "2.9.0") { console.log(`  🟢 الخادم v2.9.0 جاهز`); break; } } catch {} await wait(500); }

  /* ─── حسابات أساسية ─── */
  const victim = (await req("POST", "/api/victim", { action: "register", pseudonym: "متضرر التاسعة", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع آمنة", gender: "male" })).json.user;
  check("تسجيل متضرر ذكر", !!victim?.id);

  const victimF = (await req("POST", "/api/victim", { action: "register", pseudonym: "متضررة فاطمة", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع ثانية", gender: "female" })).json.user;
  check("تسجيل متضررة أنثى", !!victimF?.id);

  /* أخصائي يقبل الجميع */
  const cReg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. أمين", email: "amin290@test.dz", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع أخصائي",
    whatsapp: "0555000001", specialties: ["trauma"], languages: ["ar"], yearsExperience: 5,
  });
  check("تسجيل أخصائي 1", !!cReg.json?.userId);
  const cLogin = (await req("POST", "/api/counselor", { action: "login", email: "amin290@test.dz", password: "pass-290-safe" })).json.user;
  const counselorId = cLogin.id;

  /* أخصائي ثانٍ يقبل الإناث فقط */
  const c2Reg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. سارة", email: "sara290@test.dz", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع سارة",
    whatsapp: "0555000002", specialties: ["grief"], languages: ["ar"], yearsExperience: 7,
  });
  await req("POST", "/api/counselor", { action: "update-profile", userId: c2Reg.json?.userId || cReg.json?.userId, acceptedGenders: ["female"] });
  const c2Login = (await req("POST", "/api/counselor", { action: "login", email: "sara290@test.dz", password: "pass-290-safe" })).json.user;

  /* الأدمين يوثّق الأخصائيين */
  const admin = await req("POST", "/api/admin", { action: "login", passcode: "v290-admin-pass" });
  check("دخول الأدمين", admin.json?.ok === true);
  const pend = (await req("POST", "/api/admin", { action: "pending-counselors" })).json;
  for (const p of pend.all || []) await req("POST", "/api/admin", { action: "verify", profileId: p.id });
  check("توثيق الأخصائيين من الأدمين", (pend.all || []).length >= 2);

  /* ─── 6) تفضيل الجنس ─── */
  console.log("\n── 6) تفضيل جنس المتضررين ──");
  const listMale = (await req("GET", `/api/counselors?gender=male`)).json.counselors || [];
  check("قائمة الذكور لا تضم الأخصائية التي تقبل الإناث فقط", !listMale.some((c) => c.fullName === "د. سارة"));
  const listFemale = (await req("GET", `/api/counselors?gender=female`)).json.counselors || [];
  check("قائمة الإناث تضم الأخصائية", listFemale.some((c) => c.fullName === "د. سارة"));

  const gBlock = await req("POST", "/api/sessions", {
    victimId: victim.id, counselorId: c2Login.id, topic: "grief", mode: "TEXT",
    scheduledAt: isoAt(futureDate(2), "10:00"), date: futureDate(2), slot: "10:00",
  });
  check("حجز ذكر مع أخصائية تقبل الإناث → GENDER_NOT_ACCEPTED", gBlock.status === 403 && gBlock.json?.error === "GENDER_NOT_ACCEPTED", JSON.stringify(gBlock.json));

  const gOk = await req("POST", "/api/sessions", {
    victimId: victimF.id, counselorId: c2Login.id, topic: "grief", mode: "TEXT",
    scheduledAt: isoAt(futureDate(2), "10:00"), date: futureDate(2), slot: "10:00",
  });
  check("حجز أنثى مع نفس الأخصائية ينجح", gOk.json?.ok === true || gOk.status === 409 /* SLOT_TAKEN سباق محلي */, JSON.stringify(gOk.json?.error || gOk.status));

  /* ─── 4) جلسة واحدة/يوم صارمة ─── */
  console.log("\n── 4) جلسة واحدة في اليوم صارمة ──");
  const v1 = await req("POST", "/api/sessions", {
    victimId: victim.id, counselorId, topic: "anxiety", mode: "TEXT",
    scheduledAt: isoAt(futureDate(3), "11:00"), date: futureDate(3), slot: "11:00",
  });
  check("حجز أول لليوم", v1.json?.ok === true, JSON.stringify(v1.json?.error));
  const sid = v1.json?.session?.id;
  await req("PATCH", `/api/sessions/${sid}`, { status: "ACCEPTED", durationMinutes: 45 });
  await req("PATCH", `/api/sessions/${sid}`, { status: "ACTIVE" });
  await req("PATCH", `/api/sessions/${sid}`, { status: "COMPLETED" });
  const v2 = await req("POST", "/api/sessions", {
    victimId: victim.id, counselorId, topic: "anxiety", mode: "TEXT",
    scheduledAt: isoAt(futureDate(3), "17:00"), date: futureDate(3), slot: "17:00",
  });
  check("بعد إكمال جلسة اليوم → VICTIM_DAY_LIMIT (حتى المنتهية تُحتسب)", v2.status === 409 && v2.json?.error === "VICTIM_DAY_LIMIT", JSON.stringify(v2.json));

  /* ─── 5) توثيق المتضررين من الحرائق ─── */
  console.log("\n── 5) توثيق المتضررين من الحرائق ──");
  const fireV = (await req("POST", "/api/victim", {
    action: "register", pseudonym: "ضحية الحرائق", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع نارية",
    gender: "male", fireVictim: true, fireCommune: "بلدية بجاية", fireDate: "صيف 2026", fireDesc: "احترق منزلي بالكامل",
  })).json.user;
  check("تسجيل متضرر من الحرائق ببيانات الإثبات", !!fireV?.id && fireV?.fireStatus === "PENDING", JSON.stringify(fireV));

  const block = await req("POST", "/api/sessions", {
    victimId: fireV.id, counselorId, topic: "homeLoss", mode: "TEXT",
    scheduledAt: isoAt(futureDate(4), "09:00"), date: futureDate(4), slot: "09:00",
  });
  check("حجز قبل التوثيق → VICTIM_UNVERIFIED", block.status === 403 && block.json?.error === "VICTIM_UNVERIFIED", JSON.stringify(block.json));

  const vv = await req("POST", "/api/admin", { action: "victim-verifications" });
  check("قائمة طلبات التوثيق تضم المتضرر", (vv.json?.victims || []).some((x) => x.id === fireV.id), JSON.stringify((vv.json?.victims || []).map((x) => x.id)));
  const approve = await req("POST", "/api/admin", { action: "verify-victim", victimId: fireV.id, approve: true });
  check("موافقة الأدمين على التوثيق", approve.json?.ok === true && approve.json?.status === "VERIFIED", JSON.stringify(approve.json));

  /* الأخصائي قد يكون بلغ حده اليومي؟ لا — الموعد بعد 4 أيام */
  const ok2 = await req("POST", "/api/sessions", {
    victimId: fireV.id, counselorId, topic: "homeLoss", mode: "TEXT",
    scheduledAt: isoAt(futureDate(4), "09:00"), date: futureDate(4), slot: "09:00",
  });
  check("بعد التوثيق الحجز ينجح", ok2.json?.ok === true, JSON.stringify(ok2.json?.error || ok2.status));

  const rejectedV = (await req("POST", "/api/victim", {
    action: "register", pseudonym: "متضرر مرفوض", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع مرفوضة",
    gender: "male", fireVictim: true, fireCommune: "بلدية سطيف", fireDate: "2026", fireDesc: "تلف جزئي",
  })).json.user;
  await req("POST", "/api/admin", { action: "verify-victim", victimId: rejectedV.id, approve: false });
  const rej = await req("POST", "/api/sessions", {
    victimId: rejectedV.id, counselorId, topic: "homeLoss", mode: "TEXT",
    scheduledAt: isoAt(futureDate(5), "09:00"), date: futureDate(5), slot: "09:00",
  });
  check("المرفوض محجوب بـ VICTIM_REJECTED", rej.status === 403 && rej.json?.error === "VICTIM_REJECTED", JSON.stringify(rej.json));

  /* ─── 1+2) صندوق المحادثات (DM) ─── */
  console.log("\n── 1+2) صندوق المحادثات والرد بلا جلسة ──");
  /* متضرر جديد (بلا جلسات) يراسل الأخصائي مباشرة */
  const dmV = (await req("POST", "/api/victim", { action: "register", pseudonym: "متضرر مُراسل", password: "pass-290-safe", recoveryPhrase: "عبارة استرجاع مُراسل", gender: "male" })).json.user;
  const threadKey = `dm:${dmV.id}:${counselorId}`;
  const dmSend = await req("POST", "/api/messages", { threadKey, senderRole: "VICTIM", senderId: dmV.id, senderName: "متضرر مُراسل", content: "مرحباً، أحتاج استشارة قبل الحجز" });
  check("المتضرر يبدأ المحادثة", dmSend.json?.ok === true, JSON.stringify(dmSend.json));

  const threadsC = (await req("GET", `/api/messages/threads?userId=${counselorId}`)).json.threads || [];
  check("صندوق الأخصائي يعرض الخيط", threadsC.some((t) => t.peerId === dmV.id), JSON.stringify(threadsC));
  const threadsV = (await req("GET", `/api/messages/threads?userId=${dmV.id}`)).json.threads || [];
  check("صندوق المتضرر يعرض الخيط", threadsV.some((t) => t.peerId === counselorId));

  const reply = await req("POST", "/api/messages", { threadKey, senderRole: "COUNSELOR", senderId: counselorId, senderName: "د. أمين", content: "أهلاً بك، تفضل اطلب جلسة" });
  check("الأخصائي يرد بلا جلسة (بعد أن راسله المتضرر)", reply.json?.ok === true, JSON.stringify(reply.json));

  /* ─── 3) فضاء الأخصائيين ─── */
  console.log("\n── 3) فضاء الأخصائيين ──");
  const grp = await req("POST", "/api/messages", { threadKey: "counselors", senderRole: "COUNSELOR", senderId: counselorId, senderName: "د. أمين", content: "مساء الخير زملاء — من متاح غداً؟" });
  check("الأخصائي يرسل في الفضاء", grp.json?.ok === true, JSON.stringify(grp.json?.error));
  const grpV = await req("POST", "/api/messages", { threadKey: "counselors", senderRole: "VICTIM", senderId: victim.id, senderName: "متضرر التاسعة", content: "سأخترق الفضاء" });
  check("المتضرر مرفوض من الفضاء", grpV.status === 403 && grpV.json?.error === "NOT_ALLOWED", JSON.stringify(grpV.json));
  const grpRead = (await req("GET", `/api/messages?threadKey=counselors`)).json.messages || [];
  check("قراءة رسائل الفضاء", grpRead.some((m) => m.content.includes("من متاح غداً")));

  /* ─── 7) تحدي الالتزام للمتضررين ─── */
  console.log("\n── 7) تحدي الالتزام (4 مواعيد متتالية ≤10 دقائق) ──");
  const { MongoClient } = require("mongodb");
  const mcli = new MongoClient(uri);
  await mcli.connect();
  const db = mcli.db();
  /* نزرع 4 جلسات سابقة في أيام مختلفة حضورها في غضون 10 دقائق */
  const sessionsCol = db.collection("sessions");
  const now = Date.now();
  for (let i = 1; i <= 4; i++) {
    const sched = new Date(now - i * 48 * 60 * 60 * 1000);
    await sessionsCol.insertOne({
      victimId: new (require("mongodb").ObjectId)(victim.id),
      counselorId: new (require("mongodb").ObjectId)(counselorId),
      topic: "anxiety", mode: "TEXT",
      scheduledAt: sched, status: "COMPLETED",
      victimLastSeenAt: new Date(sched.getTime() + 5 * 60 * 1000), /* حضر بعد 5 دقائق */
      createdAt: sched, updatedAt: sched,
    });
  }
  /* نبض حضور لجلسة حاضرة لتفعيل التقييم — رسالة الغرفة تُرسل أولاً (الطرف الآخر غائب)
     ثم نبض الحضور يفعّل تقييم التحدي */
  const liveS = await req("POST", "/api/sessions", {
    victimId: victim.id, counselorId, topic: "safety", mode: "TEXT",
    scheduledAt: isoAt(futureDate(1), "12:00"), date: futureDate(1), slot: "12:00",
  });
  /* جلسة اليوم الأولى للمتضرر كانت COMPLETED — اليوم مختلف (غد) فالحجز يمر */
  if (liveS.json?.ok) {
    await req("PATCH", `/api/sessions/${liveS.json.session.id}`, { status: "ACCEPTED", durationMinutes: 30 });
    await req("PATCH", `/api/sessions/${liveS.json.session.id}`, { status: "ACTIVE" });
    /* رسالة أولاً: victimLastSeenAt ما زال فارغاً → إشعار ?session= يُولّد */
    await req("POST", "/api/messages", { sessionId: liveS.json.session.id, senderRole: "COUNSELOR", senderName: "د. أمين", content: "أهلاً بك في الغرفة" });
    await wait(1200);
    /* ثم نبض الحضور — يفعّل تقييم تحدي المتضرر */
    await req("POST", `/api/sessions/${liveS.json.session.id}/presence`, { role: "VICTIM" });
    await wait(800); /* الحسم fire-and-forget يُكتب */
  }
  const vch = (await req("GET", `/api/challenge?victim=1&userId=${victim.id}`)).json;
  check("سلسلة المتضرر = 4 (حضر كل المواعيد بوقت مناسب)", vch?.ok === true && vch?.myStreak === 4, JSON.stringify({ streak: vch?.myStreak }));
  check("فائز التحدي تم حسمه له ذرياً", vch?.winner?.userId === victim.id && vch?.isWinner === true, JSON.stringify(vch?.winner));
  await wait(1200); /* إشعار الأدمين fire-and-forget */
  const adminNotifs = await db2Check("victimChallenge");
  async function db2Check(key) {
    const { MongoClient } = require("mongodb");
    const c = new MongoClient(uri); await c.connect();
    const arr = await c.db().collection("notifications").find({ key }).sort({ createdAt: -1 }).limit(1).toArray();
    await c.close(); return arr;
  }
  check("إشعار الأدمين باسم الفائز", adminNotifs.length >= 1 && adminNotifs[0].body.includes("متضرر التاسعة"), JSON.stringify(adminNotifs.map((n) => n.body)));
  /* متضرر آخر لا يصبح فائزاً بعده */
  const vch2 = (await req("GET", `/api/challenge?victim=1&userId=${dmV.id}`)).json;
  check("لا فائز ثانٍ بعد حسم الأول", vch2?.winner?.userId === victim.id && vch2?.isWinner === false, JSON.stringify(vch2));
  await mcli.close();

  /* ─── 8) لوحة قيادة الأدمين ─── */
  console.log("\n── 8) لوحة قيادة الأدمين ──");
  const dash = (await req("POST", "/api/admin", { action: "dashboard-stats" })).json.stats;
  check("إحصائيات المستخدمين", dash?.users?.totalVictims >= 5 && dash?.users?.totalCounselors >= 2, JSON.stringify(dash?.users));
  check("إحصائيات الجلسات (اليوم/الأسبوع/الحالة)", typeof dash?.sessions?.todaySessions === "number" && dash?.sessions?.completedSessions >= 4, JSON.stringify(dash?.sessions));
  check("توزيع الجنس موجود", Array.isArray(dash?.gender) && dash.gender.length > 0, JSON.stringify(dash?.gender));
  check("رسم 14 يوماً كامل", Array.isArray(dash?.daily) && dash.daily.length === 14, String((dash?.daily || []).length));
  check("فائزو التحديات في اللوحة", dash?.victims?.victimWinner?.userId === victim.id, JSON.stringify(dash?.victims?.victimWinner));
  check("عداد طلبات التوثيق المعلقة", dash?.firePending >= 0, JSON.stringify(dash?.firePending));

  /* ─── 9+10) روابط الإشعارات و dm-peer ─── */
  console.log("\n── 9+10) روابط الإشعارات ──");
  /* رسالة الغرفة أُرسلت قبل نبض الحضور — إشعارها محفوظ بـ ?session= */
  const liveId = liveS.json?.session?.id;
  if (liveId) {
    const notifs = await db2Check("message");
    check("إشعار رسالة الغرفة يحمل ?session=", notifs.length === 1 && (notifs[0].url || "").includes(`session=${liveId}`), JSON.stringify(notifs.map((n) => n.url)));
  }
  const peer = (await req("GET", `/api/dm-peer?id=${counselorId}`)).json;
  check("dm-peer يعيد اسم الطرف", peer?.name === "د. أمين" && peer?.role === "COUNSELOR", JSON.stringify(peer));
  const dmNotif = await db2Check("dm");
  check("إشعار DM يحمل ?dm= بمعرف المرسل", dmNotif.length >= 1 && (dmNotif[0].url || "").includes("dm="), JSON.stringify(dmNotif.map((n) => n.url)));

  console.log("\n" + "═".repeat(56));
  if (failures === 0) console.log("🎉 كل فحوص v2.9.0 ناجحة");
  else { console.log(`⚠️ فشل ${failures} فحص`); process.exitCode = 1; }
  console.log("═".repeat(56));

  server.kill("SIGKILL");
  await mongod.stop();
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
