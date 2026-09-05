/** تشخيص: لماذا تعود قائمة الأخصائيين فارغة في صفحة victim-find */
const { spawn } = require("child_process");
const http = require("http");
const BASE = "http://localhost:3777";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => { let j = null; try { j = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
(async () => {
  const mongod = await (require("mongodb-memory-server")).MongoMemoryServer.create();
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: "3777", MONGODB_URI: mongod.getUri("dbg"), ADMIN_PASSCODE: "dbg", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 60; i++) { try { const h = await req("GET", "/api/health"); if (h.json?.version) break; } catch {} await wait(500); }
  const vA = (await req("POST", "/api/victim", { action: "register", pseudonym: "تشخيص-أ", password: "pass-dbg-123", recoveryPhrase: "عبارة أ", gender: "male" })).json.user;
  const cReg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. تشخيص", email: `dbg${Date.now()}@t.dz`, password: "pass-dbg-123", recoveryPhrase: "عبارة",
    whatsapp: "0555999777", specialties: ["trauma"], languages: ["ar"], yearsExperience: 8, bio: "نبذة اختبارية",
  });
  await req("POST", "/api/admin", { action: "login", passcode: "dbg" });
  const pendRaw = (await req("POST", "/api/admin", { action: "pending-counselors" }));
  console.log("pending status:", pendRaw.status, "keys:", Object.keys(pendRaw.json || {}), "all:", (pendRaw.json?.all || []).length);
  const pend = pendRaw.json;
  for (const p of pend.all || []) await req("POST", "/api/admin", { action: "verify", profileId: p.id });
  const plain = (await req("GET", "/api/counselors")).json;
  const gendered = (await req("GET", "/api/counselors?specialty=all&language=all&gender=male")).json;
  console.log("cReg full:", JSON.stringify(cReg.json), cReg.status); console.log("plain counselors:", (plain.counselors || []).length);
  console.log("gendered counselors:", (gendered.counselors || []).length);
  console.log("first:", JSON.stringify((plain.counselors || [])[0] || {}).slice(0, 300));
  server.kill("SIGKILL");
  await mongod.stop();
})();
