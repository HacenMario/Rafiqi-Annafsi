/**
 * اختبار v2.7.0 — التحدي السري + هاتف المتضرر السرّي
 * ─────────────────────────────────────────────────────────────
 *  1. هاتف المتضرر: تسجيل بـ05… يُطبَّع إلى 213… + رفض الرقم غير الصالح
 *     + التحديث من update-profile
 *  2. خصوصية الهاتف: يصل حصراً لأخصائي الجلسة (GET ?userId= وPATCH viewerId)
 *     ولا يظهر لأخصائي آخر ولا للمتضرر نفسه ولا بدون userId
 *  3. بطاقة الملخص (403 لغير الأخصائي) تحمل الهاتف أيضاً
 *  4. التحدي: GET بلا «required» (السر لا يُرسل) + رفض غير الأخصائي
 *     + العدّاد يتصاعد ضغطة ضغطة + الفوز عند بلوغ العدد المطلوب
 *     + فائز واحد فقط (الثاني لا يفوز) + إشعار الأدمين باسم الفائز
 *  5. شارة challengeWinner في قائمة الأخصائيين + challenge-status في الأدمين
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

/* نفس منطق الخادم: تاريخ اليوم بتوقيت الجزائر (UTC+1) + العدد المطلوب */
function algeriaToday() {
  const dz = new Date(Date.now() + 60 * 60 * 1000);
  return dz.toISOString().slice(0, 10);
}
function requiredClicks() {
  const [y, m, d] = algeriaToday().split("-").map(Number);
  return new Date(y, m, 0).getDate() - d;
}

async function main() {
  console.log("🧪 اختبار v2.7.0 — التحدي السري + هاتف المتضرر");
  console.log("─".repeat(56));

  const mongod = await MongoMemoryServer.create({ instance: { port: 27170, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");

  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: PORT,
      MONGODB_URI: uri,
      NODE_ENV: "production",
      ADMIN_PASSCODE: "rafiqi-admin-2026",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});

  const dbClient = new MongoClient(uri);

  try {
    check("الخادم يستجيب", await waitForServer());

    /* ─── 1) هاتف المتضرر: التطبيع والرفض ─── */
    console.log("① هاتف المتضرر — التسجيل والتحديث…");
    const vicOk = await req("POST", "/api/victim", {
      action: "register",
      pseudonym: `متضرر_هاتف_${Date.now() % 100000}`,
      password: "victimpass123",
      recoveryPhrase: "عبارة استرجاع صحيحة",
      phone: "0555123456",
    });
    check("تسجيل متضرر برقم محلي ينجح", vicOk.json?.ok === true);
    check("الرقم طُبِّع دولياً 213…", vicOk.json?.user?.phone === "213555123456", `got=${vicOk.json?.user?.phone}`);
    const victim1 = vicOk.json?.user?.id;

    const vicNoPhone = await req("POST", "/api/victim", {
      action: "register",
      pseudonym: `متضرر_بلا_هاتف_${Date.now() % 100000}`,
      password: "victimpass123",
      recoveryPhrase: "عبارة استرجاع صحيحة",
    });
    check("الهاتف اختياري (بدونه ينجح)", vicNoPhone.json?.ok === true && !vicNoPhone.json?.user?.phone);
    const victim2 = vicNoPhone.json?.user?.id;

    const vicBad = await req("POST", "/api/victim", {
      action: "register",
      pseudonym: `متضرر_خطأ_${Date.now() % 100000}`,
      password: "victimpass123",
      recoveryPhrase: "عبارة استرجاع صحيحة",
      phone: "abc123",
    });
    check("رقم غير صالح يُرفض INVALID_PHONE", vicBad.status === 400 && vicBad.json?.error === "INVALID_PHONE");

    const updPhone = await req("POST", "/api/victim", {
      action: "update-profile",
      userId: victim2,
      phone: "0661778899",
    });
    check("update-profile يطبّع الرقم", updPhone.json?.ok === true && updPhone.json?.user?.phone === "213661778899", `got=${updPhone.json?.user?.phone}`);

    /* ─── تجهيز: أخصائيان موثّقان ─── */
    console.log("② تجهيز أخصائيين موثّقين…");
    const regA = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "د. الأمين فائز",
      email: `dr-a-${Date.now()}@rafiqi.dz`,
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
      fullName: "د. بلال الثاني",
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
    check("الأخصائي B موثّق", !!userB);

    /* ─── 2) خصوصية الهاتف في الجلسة ─── */
    console.log("③ خصوصية الهاتف — لأخصائي الجلسة حصراً…");
    const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const booked = await req("POST", "/api/sessions", {
      victimId: victim1,
      counselorId: userA,
      topic: "grief",
      mode: "TEXT",
      scheduledAt: new Date(`${dateStr}T09:00:00`).toISOString(),
      date: dateStr,
      slot: "09:00",
    });
    const sessionId = booked.json?.session?.id || booked.json?.id;
    check("جلسة محجوزة للمتضرر1 مع الأخصائي A", !!sessionId, `resp=${JSON.stringify(booked.json).slice(0, 120)}`);

    const noViewer = await req("GET", `/api/sessions/${sessionId}`);
    check("بدون userId: لا هاتف", noViewer.json?.session?.victim?.phone == null);
    const asOther = await req("GET", `/api/sessions/${sessionId}?userId=${userB}`);
    check("أخصائي آخر: لا هاتف", asOther.json?.session?.victim?.phone == null);
    const asSelf = await req("GET", `/api/sessions/${sessionId}?userId=${victim1}`);
    check("المتضرر نفسه: لا هاتف في واجهة الجلسة", asSelf.json?.session?.victim?.phone == null);
    const asCounselor = await req("GET", `/api/sessions/${sessionId}?userId=${userA}`);
    check("أخصائي الجلسة يرى الهاتف", asCounselor.json?.session?.victim?.phone === "213555123456", `got=${asCounselor.json?.session?.victim?.phone}`);

    const patchRes = await req("PATCH", `/api/sessions/${sessionId}`, { status: "ACCEPTED", viewerId: userA });
    check("PATCH مع viewerId يُظهر الهاتف", patchRes.json?.session?.victim?.phone === "213555123456");

    const sumOk = await req("GET", `/api/sessions/${sessionId}/summary?userId=${userA}`);
    check("بطاقة الملخص للأخصائي تحمل الهاتف", sumOk.json?.summary?.phone === "213555123456");
    const sumDenied = await req("GET", `/api/sessions/${sessionId}/summary?userId=${userB}`);
    check("بطاقة الملخص ممنوعة على أخصائي آخر (403)", sumDenied.status === 403);

    /* ─── 3) التحدي السري ─── */
    console.log("④ التحدي — العدّاد والفوز والسر…");
    const st0 = await req("GET", `/api/challenge?userId=${userA}`);
    check("GET /api/challenge يعمل", st0.json?.ok === true);
    check("السر لا يُرسل (بلا required)", !("required" in (st0.json || {})), JSON.stringify(Object.keys(st0.json || {})));
    check("التحدي مفعّل", st0.json?.active === true);
    check("بداية العدّاد صفر", st0.json?.myClicks === 0);

    const vicClick = await req("POST", "/api/challenge", { userId: victim1 });
    check("متضرر يُرفض (COUNSELOR_ONLY)", vicClick.status === 400 && vicClick.json?.error === "COUNSELOR_ONLY");

    const required = requiredClicks();
    check(`العدد المطلوب اليوم = ${required} (يوم - ${algeriaToday()})`, required > 0);

    /* ضغطات A: حتى المطلوب */
    let wonAt = null;
    for (let i = 1; i <= required; i++) {
      const r = await req("POST", "/api/challenge", { userId: userA });
      if (r.json?.won) { wonAt = i; break; }
      if (!r.json?.ok) { check(`ضغطة ${i} صالحة`, false, r.json?.error); break; }
    }
    check(`الفوز عند الضغطة رقم ${required} بالضبط`, wonAt === required, `wonAt=${wonAt}`);
    const stA = await req("GET", `/api/challenge?userId=${userA}`);
    check("A هو الفائز (isWinner)", stA.json?.isWinner === true);
    check("اسم الفائز = اسم A", (stA.json?.winner?.name || "").includes("الأمين"));

    /* فائز واحد فقط: B لا يفوز ولو ضغط كثيراً */
    let bWon = false;
    for (let i = 0; i < Math.min(required + 3, 35); i++) {
      const r = await req("POST", "/api/challenge", { userId: userB });
      if (r.json?.won) { bWon = true; break; }
    }
    check("لا فائز ثانٍ", !bWon);

    /* عدّاد B مستقل عن A */
    const stB = await req("GET", `/api/challenge?userId=${userB}`);
    check("عدّاد B مستقل (لم يتأثر بفوز A)", typeof stB.json?.myClicks === "number" && stB.json?.myClicks >= 0 && stB.json?.isWinner === false);

    /* ─── 4) شارات الفائز + الأدمين ─── */
    console.log("⑤ شارة الفائز + إشعار الأدمين…");
    const list = await req("GET", "/api/counselors");
    const aCard = (list.json?.counselors || []).find((c) => c.userId === userA);
    const bCard = (list.json?.counselors || []).find((c) => c.userId === userB);
    check("بطاقة A في الدليل تحمل challengeWinner=true", aCard?.challengeWinner === true);
    check("بطاقة B بلا شارة", bCard?.challengeWinner !== true);

    const ownProfile = await req("GET", `/api/counselor?userId=${userA}`);
    check("ملف A الخاص يظهر challengeWinner", ownProfile.json?.profile?.challengeWinner === true);

    const adminCh = await req("POST", "/api/admin", { action: "challenge-status" });
    check("الأدمين يرى الفائز دائماً", adminCh.json?.winner?.name?.includes("الأمين") === true);
    check("تاريخ الفوز مسجّل", !!adminCh.json?.winner?.wonAt);

    await dbClient.connect();
    /* الإشعار fire-and-forget — مهلة قصيرة ثم فحص (بالنص "admin" أو ObjectId) */
    let notif = null;
    for (let i = 0; i < 10 && !notif; i++) {
      await wait(500);
      notif = await dbClient.db().collection("notifications").findOne({ key: "challengeWon" });
    }
    check("إشعار الأدمين وصل باسم الفائز", !!notif && (notif.body || "").includes("الأمين"), JSON.stringify(notif || {}).slice(0, 120));

    /* ─── 5) انحدار سريع: تسجيل v2.5 ما زال يعمل ─── */
    console.log("⑥ انحدار: تسجيل أخصائي عادي…");
    const regC = await req("POST", "/api/counselor", {
      action: "register",
      fullName: "د. سلوى تحقق",
      email: `dr-c-${Date.now()}@rafiqi.dz`,
      password: "testpass1234",
      recoveryPhrase: "عبارة استرجاع تجريبية",
      whatsapp: "0555112233",
      specialties: ["anxietyDepression"],
      languages: ["ar"],
    });
    check("تسجيل أخصائي جديد ينجح", regC.json?.ok === true, `status=${regC.status} resp=${JSON.stringify(regC.json).slice(0, 160)}`);
  } catch (e) {
    check("لا استثناءات", false, String(e && e.message));
    console.error(e);
  } finally {
    try { await dbClient.close(); } catch {}
    server.kill("SIGKILL");
    await wait(400);
    try { mongod.stop(); } catch {}
  }

  console.log("─".repeat(56));
  if (failures === 0) console.log("🎉 كل فحوص v2.7.0 ناجحة");
  else {
    console.log(`💥 ${failures} فحصاً فاشلاً`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
