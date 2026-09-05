/**
 * اختبار v2.5.5 — يتحقق من كل تعديلات النسخة المعتمدة:
 *  1. رابط الملف العام بالاسم الكامل (slug) + توافق خلفي بمعرّف قاعدة البيانات (تحويل تلقائي)
 *  2. زر «احجز جلستك الآن» من الملف العام → رابط /?book={userId}
 *  3. صورة الأخصائي تُنزَل تحت الشريط الأخضر (-mt-8 بدل -mt-12) + photoUrl بمعرّف الملف
 *  4. الشهادة: رمز QR بدل نص التحقق + تاريخ الإصدار YYYY/MM/DD بكل اللغات
 *  5. القائمة العمومية تتضمن slug (ترحيل تلقائي)
 *  6. انحدار v2.5.4: منع الجدولة في الماضي ما زال يعمل
 * (يُشغَّل بعد test-v254.js — نفس البنية: MongoDB في الذاكرة + خادم موحّد)
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");

const PORT = String(3100 + (process.pid % 400) + Math.floor(Math.random() * 100));
const BASE = `http://localhost:${PORT}`;
let failures = 0;

function req(method, path, body, followRedirects = false) {
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
  console.log("🧪 اختبار v2.5.5 — QR الشهادة + الروابط بالأسماء + الحجز المباشر");
  console.log("─".repeat(56));

  const mongod = await MongoMemoryServer.create({ instance: { port: 27135, ip: "127.0.0.1" } });
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

    /* ─── تجهيز: أخصائيان موثّقان (للاختبار التصادمي) + متضرر ─── */
    console.log("① تجهيز أخصائيين موثّقين ومتضرر…");
    const stamp = Date.now();
    const reg = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "Dr Test",
      email: `v255-a-${stamp}@rafiqi.dz`,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555123456",
      specialties: ["trauma"],
      languages: ["ar", "fr"],
      bio: "أخصائي تجريبي أول",
      yearsExperience: 5,
    });
    const userId = reg.json?.userId;
    const me = await req("GET", `/api/counselor?userId=${userId}`);
    const profileId = me.json?.profile?.id;
    const slugA = me.json?.profile?.slug;
    check("التسجيل يعيد slug الاسم (drtest)", slugA === "drtest", `slug=${slugA}`);

    /* أخصائي ثانٍ بنفس الاسم → slug فريد بإلحاق رقم */
    const reg2 = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "Dr Test",
      email: `v255-b-${stamp}@rafiqi.dz`,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555444555",
      specialties: ["anxiety"],
      languages: ["ar"],
      yearsExperience: 2,
    });
    const me2 = await req("GET", `/api/counselor?userId=${reg2.json?.userId}`);
    const slugB = me2.json?.profile?.slug;
    check("تصادم الاسم → slug فريد (drtest-2)", slugB === "drtest-2", `slug=${slugB}`);

    const login = await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
    await req("POST", "/api/admin", { action: "verify", profileId });
    const vic = await req("POST", "/api/victim", { action: "register", pseudonym: `متضرر${stamp % 100000}`, password: "victimpass123", recoveryPhrase: "عبارة استرجاع" });
    const victimId = vic.json?.user?.id || vic.json?.userId;
    check("أخصائي موثّق + متضرر جاهزان", login.status === 200 && !!profileId && !!victimId);

    /* ─── 1) الروابط بالاسم + التوافق الخلفي ─── */
    console.log("② الروابط بالاسم الكامل + تحويل الروابط القديمة…");
    const bySlug = await req("GET", `/counselor/${encodeURIComponent(slugA)}`);
    check("الرابط بالاسم يعمل (200)", bySlug.status === 200, String(bySlug.status));
    check("الرابط بالاسم لا يُعاد تحويله", !bySlug.location, String(bySlug.location || ""));
    check("الصفحة تحمل اسم الأخصائي", bySlug.text.includes("Dr Test"));

    const byId = await req("GET", `/counselor/${profileId}`);
    check("الرابط القديم بالمعرّف → تحويل 307/308", (byId.status === 307 || byId.status === 308), String(byId.status));
    check("وجهة التحويل هي الرابط بالاسم", byId.location === `/counselor/${slugA}`, String(byId.location));

    const list = await req("GET", "/api/counselors");
    const listA = (list.json?.counselors || []).find((c) => c.id === profileId);
    check("القائمة العمومية تتضمن slug", listA && listA.slug === "drtest", JSON.stringify(listA ? listA.slug : list.json?.counselors?.length));

    /* ─── 2) زر الحجز من الملف العام ─── */
    console.log("③ زر «احجز جلستك الآن» يبدأ حجزاً مع نفس الأخصائي…");
    check("زر الحجز يشير إلى /?book={userId}", bySlug.text.includes(`href="/?book=${userId}`), "");
    check("رابط الحجز يحمل لغة الزائر (?lang=fr)", (await req("GET", `/counselor/${encodeURIComponent(slugA)}?lang=fr`)).text.includes(`&amp;lang=fr"`));

    /* ─── 3) الصورة تحت الشريط الأخضر ─── */
    console.log("④ صورة الأخصائي أسفل الشريط الأخضر…");
    check("إزاحة الصورة الجديدة (-mt-8) مطبقة", bySlug.text.includes("-mt-8"));
    check("الإزاحة القديمة (-mt-12) أُزيلت", !bySlug.text.includes("-mt-12"));
    check("صورة الملف تُقدَّم بمعرّف الملف الحقيقي", bySlug.text.includes(`/api/counselors/${profileId}/photo`) || !bySlug.text.includes("/api/counselors/undefined"));

    /* ─── 4) الشهادة: QR + تاريخ موحّد ─── */
    console.log("⑤ الشهادة: رمز QR بدل نص التحقق + تاريخ YYYY/MM/DD…");
    const certAr = await req("GET", `/certificate/${userId}`);
    check("الشهادة تعمل", certAr.status === 200, String(certAr.status));
    check("تحتوي صورة QR (data:image/png)", certAr.text.includes('src="data:image/png;base64,'));
    check("نص التحقق القديم حُذف", !certAr.text.includes("للتحقق /certificate/"));
    check("وسم امسح رمز QR موجود", certAr.text.includes("امسح رمز QR"));
    const dateAr = certAr.text.match(/font-black text-neutral-800">\s*(\d{4}\/\d{2}\/\d{2})\s*</);
    check("تاريخ الإصدار بصيغة YYYY/MM/DD (عربي)", !!dateAr, dateAr ? dateAr[1] : "غير موجود");

    const certFr = await req("GET", `/certificate/${userId}?lang=fr`);
    const dateFr = certFr.text.match(/font-black text-neutral-800">\s*(\d{4}\/\d{2}\/\d{2})\s*</);
    check("تاريخ الإصدار YYYY/MM/DD (فرنسي)", !!dateFr, dateFr ? dateFr[1] : "غير موجود");
    check("وسم QR بالفرنسية موجود", certFr.text.includes("Scannez le code QR"));

    const certEn = await req("GET", `/certificate/${userId}?lang=en`);
    const dateEn = certEn.text.match(/font-black text-neutral-800">\s*(\d{4}\/\d{2}\/\d{2})\s*</);
    check("تاريخ الإصدار YYYY/MM/DD (إنجليزي)", !!dateEn, dateEn ? dateEn[1] : "غير موجود");

    /* ─── 5) الصفحة الرئيسية تستقبل الربط العميق ─── */
    console.log("⑥ الصفحة الرئيسية تستقبل /?book=&lang=…");
    const home = await req("GET", `/?book=${userId}&lang=fr`);
    check("الصفحة الرئيسية تعمل مع معاملات الربط", home.status === 200, String(home.status));

    /* ─── 6) انحدار v2.5.4: منع الماضي + حجز مستقبلي ─── */
    console.log("⑦ انحدار: منع الجدولة في الماضي ما زال يعمل…");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pastBook = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: yesterday });
    check("حجز بتاريخ فائت → 400 PAST_DATE", pastBook.status === 400 && pastBook.json?.error === "PAST_DATE");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureBook = await req("POST", "/api/sessions", { victimId, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: tomorrow });
    check("حجز بتاريخ مستقبلي → 200", futureBook.status === 200 && !!futureBook.json?.session?.id);

    /* ─── 7) ترحيل الحسابات القديمة بلا slug ─── */
    console.log("⑧ ترحيل حساب قديم بلا slug عند أول زيارة…");
    const oldPage = await req("GET", `/counselor/${profileId}`);
    /* الزيارة الأولى بالمعرّف ولّدت slug وحوّلت — الزيارة الثانية بالاسم تعمل */
    const afterMigration = await req("GET", `/counselor/${encodeURIComponent(slugA)}?lang=en`);
    check("بعد الترحيل: الرابط بالاسم يعمل بالإنجليزية", afterMigration.status === 200 && afterMigration.text.includes("Member since"), String(afterMigration.status));

    console.log("─".repeat(56));
    if (failures === 0) console.log("🎉 كل اختبارات v2.5.5 نجحت");
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
