/**
 * اختبار شامل v2.5.3 — يرفع MongoDB في الذاكرة + الخادم الموحّد
 * ويتحقق من كل الميزات الجديدة طرفاً لطرف:
 *  1. الملف الخفيف GET /api/counselor?userId
 *  2. قائمة الأخصائيين بدون صور base64 + photoUrl يعمل
 *  3. الملف العام /api/counselors/{id} + صفحة /counselor/{id}
 *  4. شهادة /certificate/{userId} (غير موثّق → موثّق بعد admin verify)
 *  5. ملخص المتضرر /api/sessions/{id}/summary (حماية 403 + بيانات)
 *  6. رفع الإصدار v2.5.3 في /api/health إن وُجد
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
          try { json = JSON.parse(buf); } catch { /* HTML */ }
          resolve({ status: res.statusCode, json, text: buf, location: res.headers.location });
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

async function main() {
  console.log("🧪 اختبار v2.5.3 الشامل");
  console.log("─".repeat(56));

  console.log("① تشغيل MongoDB في الذاكرة…");
  const mongod = await MongoMemoryServer.create({ instance: { port: 27133, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");
  console.log(`   → ${uri.replace(/\/\/.*@/, "//***@")}`);

  console.log("② تشغيل الخادم الموحّد (وضع إنتاج على 3111)…");
  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: PORT, MONGODB_URI: uri, NODE_ENV: "production", ADMIN_PASSCODE: "rafiqi-admin-2026" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write(`   [srv] ${d}`));
  server.stderr.on("data", (d) => process.stdout.write(`   [err] ${d}`));

  try {
    check("الخادم يستجيب خلال 60 ثانية", await waitForServer());

    /* ─── تسجيل أخصائي ─── */
    console.log("③ تسجيل أخصائي اختباري…");
    const email = `test-v253-${Date.now()}@rafiqi.dz`;
    const reg = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "د. أحمد التجريبي",
      email,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555123456",
      specialties: ["trauma", "grief"],
      languages: ["ar", "fr"],
      bio: "أخصائي نفسي تجريبي لاختبار v2.5.3",
      yearsExperience: 7,
    });
    check("تسجيل الأخصائي (register)", reg.status === 200 && reg.json?.ok === true, JSON.stringify(reg.json));
    const userId = reg.json?.userId;
    check("معرّف المستخدم عاد", !!userId);

    /* ─── الملف الخفيف الخاص ─── */
    console.log("④ GET /api/counselor?userId (المسار الخفيف)…");
    const me = await req("GET", `/api/counselor?userId=${userId}`);
    check("يعيد 200", me.status === 200);
    check("يحتوي profile.id (معرّف الملف العام)", !!me.json?.profile?.id);
    check("verificationStatus = PENDING", me.json?.profile?.verificationStatus === "PENDING");
    check("sessionsCount = 0", me.json?.profile?.sessionsCount === 0);
    const profileId = me.json?.profile?.id;

    /* ─── قائمة الأخصائيين (قبل التوثيق: فارغة) ─── */
    const list0 = await req("GET", "/api/counselors");
    check("القائمة تعمل (فارغة قبل التوثيق)", list0.status === 200 && (list0.json?.counselors || []).length === 0);

    /* ─── admin verify ─── */
    console.log("⑤ التوثيق عبر الأدمين…");
    const login = await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
    check("دخول الأدمين", login.status === 200 && login.json?.ok === true);
    const verify = await req("POST", "/api/admin", { action: "verify", profileId });
    check("توثيق الأخصائي", verify.status === 200 && verify.json?.ok === true, JSON.stringify(verify.json));

    const list1 = await req("GET", "/api/counselors");
    const card = (list1.json?.counselors || []).find((c) => c.userId === userId);
    check("الأخصائي ظهر في القائمة", !!card);
    check("القائمة تعيد photoUrl (لا base64)", card && typeof card.photoUrl === "string" && card.photoUrl.includes("/photo") && !card.photoUrl.startsWith("data:"));
    check("القائمة لا تحمل أي حقل photo قديم", card && card.photo === undefined);

    /* ─── الملف العام ─── */
    console.log("⑥ الملف العام…");
    const pub = await req("GET", `/api/counselors/${profileId}`);
    check("GET /api/counselors/{id} يعمل", pub.status === 200 && pub.json?.profile?.verified === true);
    check("لا يحتوي واتساب", pub.json?.profile && !("whatsapp" in pub.json.profile));
    check("لا يحتوي diplomaImage", pub.json?.profile && !("diplomaImage" in pub.json.profile));
    /* v2.5.5: الوصول بمعرّف قاعدة البيانات يُحوَّل تلقائياً إلى /counselor/{slug} */
    const pubPage = await req("GET", `/counselor/${profileId}`);
    const followed = pubPage.status === 307 && pubPage.location ? await req("GET", /[\x00-\x7F]/.test(pubPage.location) ? pubPage.location : encodeURI(pubPage.location)) : pubPage;
    check("صفحة /counselor/{id} تعيد HTML 200 (بعد التحويل إلى slug)", (pubPage.status === 307 || pubPage.status === 200) && followed.status === 200 && followed.text.includes("د. أحمد التجريبي"), `pub=${pubPage.status}/${pubPage.location || "-"} fol=${followed.status} len=${followed.text.length}`);

    /* ─── الشهادة ─── */
    console.log("⑦ الشهادة…");
    const certPage = await req("GET", `/certificate/${userId}`);
    check("صفحة الشهادة تعيد HTML 200", certPage.status === 200);
    check("الشهادة تحمل اسم الأخصائي", certPage.text.includes("د. أحمد التجريبي"));
    check("الشهادة تحمل الرقم التسلسلي RFQ-", certPage.text.includes("RFQ-"));
    check("عداد الجلسات = 0 قبل أي جلسة", !certPage.text.match(/>\s*[1-9]\s*<\/span>\s*جلسة دعم مكتملة/));

    /* ─── متضرر + جلسة + ملخص ─── */
    console.log("⑧ متضرر وجلسات وملخص…");
    const vic = await req("POST", "/api/victim", { action: "register", pseudonym: `متجرب${Date.now() % 100000}`, password: "victimpass123", recoveryPhrase: "عبارة استرجاع المتضرر التجريبية" });
    check("تسجيل متضرر", vic.status === 200 && vic.json?.ok === true, JSON.stringify(vic.json).slice(0, 120));
    const victimId = vic.json?.user?.id || vic.json?.userId;
    const sess = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: new Date().toISOString() });
    check("إنشاء جلسة", sess.status === 200 && !!sess.json?.session?.id, JSON.stringify(sess.json).slice(0, 150));
    const sessionId = sess.json?.session?.id;
    await req("PATCH", `/api/sessions/${sessionId}`, { status: "ACCEPTED" });

    /* ملخص قبل اكتمال أي جلسة */
    const sum0 = await req("GET", `/api/sessions/${sessionId}/summary?userId=${userId}`);
    check("الملخص يعمل (200)", sum0.status === 200 && sum0.json?.summary);
    check("previousSessions = 0", sum0.json?.summary?.previousSessions === 0);

    /* حماية 403 لأخصائي آخر — نستخدم معرّف عشوائي */
    const sumForbidden = await req("GET", `/api/sessions/${sessionId}/summary?userId=000000000000000000000000`);
    check("حماية 403 لأخصائي غير معني", sumForbidden.status === 403);

    /* جلسة أولى تكتمل بمزاج وملاحظة */
    await req("PATCH", `/api/sessions/${sessionId}`, { status: "ACTIVE" });
    await req("PATCH", `/api/sessions/${sessionId}`, { moodBefore: 2, moodAfter: 4, notes: "أشعر بتحسن ملحوظ اليوم" });
    await req("PATCH", `/api/sessions/${sessionId}`, { status: "COMPLETED" });

    /* جلسة ثانية: الملخص يجب أن يعرض previousSessions = 1
       (v2.9.0: جلسة واحدة/يوم صارمة — المنتهية تُحتسب، لذا نحجز غداً) */
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sess2 = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: tomorrow });
    const sessionId2 = sess2.json?.session?.id;
    await req("PATCH", `/api/sessions/${sessionId2}`, { status: "ACCEPTED" });
    const sum1 = await req("GET", `/api/sessions/${sessionId2}/summary?userId=${userId}`);
    check("previousSessions = 1 بعد أول جلسة مكتملة", sum1.json?.summary?.previousSessions === 1);
    check("متوسط المزاج قبل=2 بعد=4", sum1.json?.summary?.avgMoodBefore === 2 && sum1.json?.summary?.avgMoodAfter === 4);
    check("آخر ملاحظة وصلت", (sum1.json?.summary?.lastNotes || "").includes("تحسن ملحوظ"));

    /* العداد في الشهادة تحدّث تلقائياً */
    const certPage2 = await req("GET", `/certificate/${userId}`);
    check("شهادة عدادها = 1 بعد الجلسة المكتملة", certPage2.status === 200 && /align-middle font-mono">\s*1\s*</.test(certPage2.text), certPage2.status === 200 ? "HTML لا يحوي العداد 1" : String(certPage2.status));

    /* ─── صورة وهمية: photoUrl ─── */
    console.log("⑨ مسار الصور…");
    const photo404 = await req("GET", `/api/counselors/${profileId}/photo`);
    check("صورة غير موجودة → 404 نظيف", photo404.status === 404);

    /* ─── الصفحة الرئيسية تعمل ─── */
    const home = await req("GET", "/");
    check("الصفحة الرئيسية 200", home.status === 200);

    console.log("─".repeat(56));
    if (failures === 0) console.log("🎉 كل الاختبارات نجحت — v2.5.3 جاهزة");
    else { console.log(`💥 فشل ${failures} اختبار/اختبارات`); process.exitCode = 1; }
  } finally {
    server.kill("SIGTERM");
    setTimeout(() => { try { server.kill("SIGKILL"); } catch {} }, 1200);
    await mongod.stop();
  }
}

main().catch((e) => {
  console.error("💥 فشل الاختبار:", e);
  process.exit(1);
});
