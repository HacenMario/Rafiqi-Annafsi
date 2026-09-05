/**
 * اختبار v2.5.4 — يتحقق من كل التصحيحات الجديدة فوق v2.5.3:
 *  1. منع الجدولة في الماضي (حجز جديد + جلسة متابعة) — تحقق الخادم
 *  2. الملف العام: مبدّل اللغة ?lang= + حذف السطرين + صورة فوق شريط الانحناء
 *  3. «عضو منذ» بصيغة YYYY/MM في API الملف العام والشهادة
 *  4. سجل الأزمات المُثرى: المتضرر المستعار + اسم الأخصائي + من كتب العبارة
 * (يُشغَّل بعد test-v253.js — نفس البنية: MongoDB في الذاكرة + خادم موحّد)
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");

const PORT = String(3100 + (process.pid % 400) + Math.floor(Math.random() * 100));
const BASE = `http://localhost:${PORT}`;
let failures = 0;

async function req(method, path, body, follow = false) {
  const first = await reqOnce(method, path, body);
  if (follow && (first.status === 307 || first.status === 308) && first.location) {
    return reqOnce("GET", /[^\x00-\x7F]/.test(first.location) ? encodeURI(first.location) : first.location);
  }
  return first;
}

function reqOnce(method, path, body) {
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
  console.log("🧪 اختبار v2.5.4 — التصحيحات الجديدة");
  console.log("─".repeat(56));

  const mongod = await MongoMemoryServer.create({ instance: { port: 27134, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");

  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: PORT, MONGODB_URI: uri, NODE_ENV: "production", ADMIN_PASSCODE: "rafiqi-admin-2026" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write(`   [srv] ${d}`));
  server.stderr.on("data", (d) => process.stdout.write(`   [err] ${d}`));

  try {
    check("الخادم يستجيب", await waitForServer());

    /* ─── تجهيز: أخصائي موثّق + متضرر ─── */
    console.log("① تجهيز أخصائي موثّق ومتضرر…");
    const reg = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "د. أمينة التجريبية",
      email: `test-v254-${Date.now()}@rafiqi.dz`,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555123456",
      specialties: ["trauma"],
      languages: ["ar", "fr"],
      bio: "أخصائية تجريبية",
      yearsExperience: 5,
    });
    const userId = reg.json?.userId;
    const me = await req("GET", `/api/counselor?userId=${userId}`);
    const profileId = me.json?.profile?.id;
    const login = await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
    await req("POST", "/api/admin", { action: "verify", profileId });
    check("أخصائي موثّق جاهز", reg.status === 200 && login.status === 200 && !!profileId);

    const vic = await req("POST", "/api/victim", { action: "register", pseudonym: `متضرر${Date.now() % 100000}`, password: "victimpass123", recoveryPhrase: "عبارة استرجاع" });
    const victimId = vic.json?.user?.id || vic.json?.userId;
    const victimAlias = vic.json?.user?.pseudonym || "";
    check("متضرر جاهز", !!victimId);

    /* ─── 1) منع الجدولة في الماضي ─── */
    console.log("② منع الجدولة في الماضي (تحقق الخادم)…");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pastBook = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: yesterday });
    check("حجز بتاريخ فائت → 400 PAST_DATE", pastBook.status === 400 && pastBook.json?.error === "PAST_DATE", JSON.stringify(pastBook.json));

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureBook = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: tomorrow });
    check("حجز بتاريخ مستقبلي → 200", futureBook.status === 200 && !!futureBook.json?.session?.id);
    const futureSessionId = futureBook.json?.session?.id;

    /* متابعة فائتة مرفوضة */
    const pastFollow = await req("PATCH", `/api/sessions/${futureSessionId}`, { followUpAt: yesterday });
    check("جدولة متابعة فائتة → 400 PAST_DATE", pastFollow.status === 400 && pastFollow.json?.error === "PAST_DATE");

    /* متابعة مستقبلية تعمل وتنشئ جلسة */
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const okFollow = await req("PATCH", `/api/sessions/${futureSessionId}`, { followUpAt: nextWeek });
    check("جدولة متابعة مستقبلية → 200 + جلسة منشأة", okFollow.status === 200 && !!okFollow.json?.followUpCreated);

    /* ─── 2) الملف العام: اللغة + السطران + الترتيب ─── */
    console.log("③ الملف العام (?lang + السطران المحذوفان)…");
    const pageAr = await req("GET", `/counselor/${profileId}`, null, true);
    check("الصفحة بالعربية افتراضياً", pageAr.status === 200 && pageAr.text.includes("عضو منذ"));
    check("مبدّل اللغة موجود (?lang=fr)", pageAr.text.includes(`?lang=fr`));
    check("مبدّل اللغة موجود (?lang=en)", pageAr.text.includes(`?lang=en`));
    check("السطر «الأخصائيون موثّقون…» حُذف", !pageAr.text.includes("الأخصائيون موثّقون"));
    check("السطر «هوية المتضررين محمية…» حُذف", !pageAr.text.includes("هوية المتضررين محمية"));

    const pageFr = await req("GET", `/counselor/${profileId}?lang=fr`, null, true);
    check("?lang=fr يعرض الفرنسية (Membre depuis)", pageFr.status === 200 && pageFr.text.includes("Membre depuis"), pageFr.status === 200 ? "لا يحتوي Membre depuis" : String(pageFr.status));
    check("?lang=fr بالاتجاه LTR", pageFr.text.includes('dir="ltr"'));
    check("?lang=fr بلا نصوص عربية للواجهة", !pageFr.text.includes("عضو منذ"));

    const pageEn = await req("GET", `/counselor/${profileId}?lang=en`, null, true);
    check("?lang=en يعرض الإنجليزية (Member since)", pageEn.status === 200 && pageEn.text.includes("Member since"));

    /* ─── 3) عضو منذ YYYY/MM ─── */
    console.log("④ «عضو منذ» بصيغة YYYY/MM…");
    const pub = await req("GET", `/api/counselors/${profileId}`);
    check("API الملف العام يعيد YYYY/MM", /^\d{4}\/\d{2}$/.test(String(pub.json?.profile?.memberSince ?? "")), String(pub.json?.profile?.memberSince));
    check("الشهادة تعرض YYYY/MM", /font-mono text-neutral-800">\s*\d{4}\/\d{2}\s*</.test((await req("GET", `/certificate/${userId}`)).text));
    check("الملف العام يعرض YYYY/MM", /\d{4}\/\d{2}/.test(pageAr.text));

    /* ─── 4) سجل الأزمات المُثرى ─── */
    console.log("⑤ سجل الأزمات: المتضرر + الأخصائي + كاتب العبارة…");
    /* جلسة مكتملة مع رسالة أزمة عبر REST */
    const crisisSession = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "trauma", mode: "TEXT", scheduledAt: new Date().toISOString() });
    const csId = crisisSession.json?.session?.id;
    await req("PATCH", `/api/sessions/${csId}`, { status: "ACTIVE" });
    const msg = await req("POST", "/api/messages", { sessionId: csId, senderRole: "VICTIM", senderName: victimAlias, content: "أريد الموت" });
    check("رسالة الأزمة وصلت وعُلّمت", msg.status === 200 && !!msg.json?.crisis);
    await req("PATCH", `/api/sessions/${csId}`, { status: "COMPLETED" });

    const crisisList = await req("GET", "/api/crisis");
    const lastLog = (crisisList.json?.logs || [])[0] || {};
    check("السجل يذكر من كتب العبارة (VICTIM)", lastLog.saidBy === "VICTIM", JSON.stringify(lastLog).slice(0, 160));
    check("السجل يذكر الاسم المستعار للمتضرر", lastLog.victimAlias === victimAlias, `متوقع: ${victimAlias}`);
    check("السجل يذكر اسم الأخصائي", lastLog.counselorName === "د. أمينة التجريبية");

    /* سجل الأدمين نفس الإثراء */
    const adminCrisis = await req("POST", "/api/admin", { action: "crisis-log", passcode: "rafiqi-admin-2026" });
    const adminLast = (adminCrisis.json?.logs || [])[0] || {};
    check("سجل الأدمين مُثرى أيضاً", adminLast.saidBy === "VICTIM" && adminLast.victimAlias === victimAlias && !!adminLast.counselorName);

    /* ─── 5) انحدار: الحجز «الآن» بلا scheduledAt ما زال يعمل ───
       (v2.9.0: جلسة واحدة/يوم صارمة — نستعمل متضرراً جديداً لهذا الفحص) */
    console.log("⑥ انحدار: الحجز الفوري بلا موعد…");
    const nv = await req("POST", "/api/victim", { action: "register", pseudonym: "متضرر الفوري 254", password: "pass-v254-safe", recoveryPhrase: "عبارة استرجاع فورية" });
    const nowBook = await req("POST", "/api/sessions", { victimId: nv.json?.user?.id, counselorId: userId, topic: "grief", mode: "TEXT" });
    check("حجز بلا scheduledAt → 200 (سماحية دقيقتين)", nowBook.status === 200, JSON.stringify(nowBook.json?.error));

    console.log("─".repeat(56));
    if (failures === 0) console.log("🎉 كل اختبارات v2.5.4 نجحت");
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
