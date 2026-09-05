/* خادم مرئي v2.7.0: منصة بأخصائي فائز بالتحدي + متضرر — للتحقق بالمتصفح */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");

const BASE = "http://localhost:3113";
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let buf = ""; res.on("data", (c) => (buf += c));
      res.on("end", () => { let json = null; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json, text: buf }); });
    });
    r.on("error", reject); if (data) r.write(data); r.end();
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27136, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");
  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3113", MONGODB_URI: uri, NODE_ENV: "production", ADMIN_PASSCODE: "rafiqi-admin-2026" },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 60; i++) {
    try { const r = await req("GET", "/api/health"); if (r.status === 200) break; } catch {}
    await wait(800);
  }
  console.log(JSON.stringify({ ready: true, base: BASE }));

  /* أخصائيان موثّقان — الأول سيصبح فائز التحدي */
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const reg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. أمين صالحي", email: `win-${Date.now()}@rafiqi.dz`,
    password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية طويلة", whatsapp: "0555123456",
    specialties: ["trauma", "grief"], languages: ["ar", "fr"],
    bio: "أخصائي نفسي سريري، خبرة 12 سنة في دعم ضحايا الكوارث والصدمات النفسية، وأعمل على مساعدة النازحين وفاقدي المسكن بأساليب العلاج المعرفي السلوكي الحديثة. أؤمن بأن التعافي رحلة تبدأ بخطوة صغيرة، وأن لكل إنسان قدرته على تجاوز الأزمة حين يجد الأذن الصحيحة التي تسمعه.",
    yearsExperience: 12, photo: `data:image/png;base64,${png.toString("base64")}`,
  });
  const winnerUserId = reg.json?.userId;
  const me = await req("GET", `/api/counselor?userId=${winnerUserId}`);
  await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
  await req("POST", "/api/admin", { action: "verify", profileId: me.json?.profile?.id });

  const reg2 = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. بلال مرزوقي", email: `b-${Date.now()}@rafiqi.dz`,
    password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية طويلة", whatsapp: "0555987654",
    specialties: ["anxietyDepression"], languages: ["ar"],
    bio: "أخصائي علم نفس، مختص في القلق والاكتئاب لدى المراهقين والكبار، مع 7 سنوات خبرة ميدانية.",
    yearsExperience: 7,
  });
  const otherUserId = reg2.json?.userId;
  const me2 = await req("GET", `/api/counselor?userId=${otherUserId}`);
  await req("POST", "/api/admin", { action: "verify", profileId: me2.json?.profile?.id });

  /* متضرر برقم هاتف + جلسة محجوزة مع الأخصائي الفائز */
  const vic = await req("POST", "/api/victim", {
    action: "register", pseudonym: "نجمة 27", password: "victimpass123",
    recoveryPhrase: "عبارة استرجاع تجريبية", phone: "0661778899",
  });
  const victimId = vic.json?.user?.id;

  /* الفوز بالتحدي: الضغطات المطلوبة لهذا اليوم */
  const now = new Date(Date.now() + 3600000);
  const [y, m, d] = now.toISOString().slice(0, 10).split("-").map(Number);
  const required = new Date(y, m, 0).getDate() - d;
  let won = false;
  for (let i = 0; i < required && !won; i++) {
    const r = await req("POST", "/api/challenge", { userId: winnerUserId });
    won = !!r.json?.won;
  }
  console.log(JSON.stringify({ required, won, winnerUserId, otherUserId, victimId }));

  /* جلسة للمتضرر مع الفائز (لعرض الهاتف في الغرفة) */
  const fut = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  const ds = fut.toISOString().slice(0, 10);
  await req("POST", "/api/sessions", {
    victimId, counselorId: winnerUserId, topic: "grief", mode: "TEXT",
    scheduledAt: new Date(`${ds}T09:00:00`).toISOString(), date: ds, slot: "09:00",
  });

  console.log("SEEDED — اضغط Ctrl+C للإيقاف");
  setInterval(() => {}, 1 << 30);
}
main().catch((e) => { console.error(e); process.exit(1); });
