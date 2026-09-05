/** تشخيص: لماذا لا يُخزَّن إشعار الأدمين؟ — تشغيل مرئي مع سجلات الخادم */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { MongoClient } = require("mongodb");

const PORT = "3777";
const BASE = `http://localhost:${PORT}`;

async function req(method, path, body) {
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
  const mongod = await MongoMemoryServer.create({ instance: { port: 27291, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");
  const server = spawn("node", ["server.js", "--prod"], { cwd: process.cwd(), env: { ...process.env, PORT, MONGODB_URI: uri, NODE_ENV: "production", ADMIN_PASSCODE: "x-pass" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
  server.stderr.on("data", (d) => process.stdout.write(`[err] ${d}`));

  for (let i = 0; i < 40; i++) { try { const r = await req("GET", "/api/health"); if (r.status === 200) break; } catch {} await wait(500); }

  const reg = await req("POST", "/api/counselor", { action: "register", fullName: "د. فائز تشخيص", email: `x-${Date.now()}@t.dz`, password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية", whatsapp: "0555000111", specialties: ["trauma"], languages: ["ar"] });
  const uid = reg.json.userId;
  const me = await req("GET", `/api/counselor?userId=${uid}`);
  await req("POST", "/api/admin", { action: "login", passcode: "x-pass" });
  await req("POST", "/api/admin", { action: "verify", profileId: me.json.profile.id });

  const required = 27;
  for (let i = 0; i < required; i++) {
    const r = await req("POST", "/api/challenge", { userId: uid });
    if (i === 0 || r.json?.won) console.log("click", i + 1, JSON.stringify(r.json));
  }
  await wait(2500);
  const client = new MongoClient(uri);
  await client.connect();
  const notifs = await client.db().collection("notifications").find({}).toArray();
  console.log("NOTIFS:", JSON.stringify(notifs, null, 1));
  await client.close();
  server.kill("SIGKILL");
  await wait(300);
  await mongod.stop();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
