/* تشخيص سريع: مسار الفوز → إشعار الأدمين (نسخة مصغّرة من test-v270) */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { MongoClient } = require("mongodb");

const PORT = String(3600 + (process.pid % 200));
const BASE = `http://localhost:${PORT}`;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => { let j = null; try { j = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("rafiqi-test");
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT, MONGODB_URI: uri, ADMIN_PASSCODE: "test-admin-pass", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
  server.stderr.on("data", (d) => process.stdout.write(`[err] ${d}`));

  for (let i = 0; i < 60; i++) {
    try { const h = await req("GET", "/api/health"); if (h.json) break; } catch {}
    await wait(500);
  }

  // تسجيل أخصائي
  const reg = await req("POST", "/api/counselor", {
    action: "register",
    fullName: "د. الأمين التجريبي",
    email: `a-${Date.now()}@t.dz`,
    password: "testpass1234",
    recoveryPhrase: "عبارة استرجاع تجريبية",
    whatsapp: "0555123456",
    specialties: ["trauma"],
    languages: ["ar", "fr"],
    yearsExperience: 5,
  });
  console.log("register:", reg.status, JSON.stringify(reg.json || {}).slice(0, 200));
  const userId = reg.json?.userId;
  if (!userId) { console.log("NO USER — abort"); server.kill("SIGKILL"); await mongod.stop(); return; }

  // ولوج الأدمين لإنشاء حسابه الحقيقي
  const adm = await req("POST", "/api/admin", { action: "login", passcode: "test-admin-pass" });
  console.log("admin login:", JSON.stringify(adm.json || {}).slice(0, 120));

  // ضغطات حتى الفوز (الحد الأقصى 40)
  let won = false;
  for (let i = 0; i < 40 && !won; i++) {
    const c = await req("POST", "/api/challenge", { userId });
    if (c.json?.won) won = true;
  }
  console.log("won:", won);
  await wait(3000);

  const mc = new MongoClient(uri);
  await mc.connect();
  const docs = await mc.db().collection("notifications").find({}).toArray();
  console.log("notifications:", JSON.stringify(docs, null, 1).slice(0, 1500));
  const users = await mc.db().collection("users").find({}, { projection: { role: 1, pseudonym: 1 } }).toArray();
  console.log("users:", JSON.stringify(users));
  await mc.close();
  server.kill("SIGKILL");
  await wait(300);
  await mongod.stop();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
