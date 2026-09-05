/* خادم مرئي للاختبار: يرفع منصة بأخصائي موثّق مع صورة + متضرر وجلسة مكتملة */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

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
  const mongod = await MongoMemoryServer.create({ instance: { port: 27135, ip: "127.0.0.1" } });
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
  /* صورة تجريبية 400×400 (PNG صغير مولّد برمجياً) */
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"
  );
  const reg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. أمينة بوعلام", email: `vis-${Date.now()}@rafiqi.dz`,
    password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية طويلة بما يكفي", whatsapp: "0555123456",
    specialties: ["trauma", "grief"], languages: ["ar", "fr"], bio: "أخصائية نفسانية سريرية، 12 سنة خبرة في دعم ضحايا الكوارث.", yearsExperience: 12,
    photo: `data:image/png;base64,${png1x1.toString("base64")}`,
  });
  const userId = reg.json?.userId;
  const me = await req("GET", `/api/counselor?userId=${userId}`);
  await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
  await req("POST", "/api/admin", { action: "verify", profileId: me.json?.profile?.id });
  const vic = await req("POST", "/api/victim", { action: "register", pseudonym: "نجمة", password: "victimpass123", recoveryPhrase: "عبارة استرجاع تجريبية" });
  for (let i = 0; i < 3; i++) {
    const s = await req("POST", "/api/sessions", { victimId: vic.json?.user?.id, counselorId: userId, topic: "grief", mode: "TEXT", scheduledAt: new Date().toISOString() });
    const sid = s.json?.session?.id;
    await req("PATCH", `/api/sessions/${sid}`, { status: "ACTIVE" });
    await req("PATCH", `/api/sessions/${sid}`, { moodBefore: 2 + i, moodAfter: 4, notes: i === 0 ? "أشعر بتحسن تدريجي" : undefined });
    await req("PATCH", `/api/sessions/${sid}`, { status: "COMPLETED" });
  }
  fs.writeFileSync("/tmp/visual-ids.json", JSON.stringify({ userId, profileId: me.json?.profile?.id }));
  console.log("REG:", JSON.stringify(reg.json).slice(0,200)); console.log("ME:", JSON.stringify(me.json).slice(0,200)); console.log("READY", userId, me.json?.profile?.id);
  setInterval(() => {}, 60000);
}
main().catch((e) => { console.error(e); process.exit(1); });
