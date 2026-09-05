/* تشخيص: هل يُحفظ lateFlagged=true بعد المسح؟ */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = "3777";
const BASE = `http://localhost:${PORT}`;

async function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => resolve({ status: res.statusCode, json: JSON.parse(buf || "{}") }));
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27150, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");
  const launch = new Date(Date.now() - 5 * 86400000).toISOString();
  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT, MONGODB_URI: uri, NODE_ENV: "production", ADMIN_PASSCODE: "x12345678", V26_LAUNCH: launch },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", (d) => process.stdout.write(`[err] ${d}`));
  await new Promise((r) => setTimeout(r, 9000));

  const cli = new MongoClient(uri);
  await cli.connect();
  const db = cli.db("rafiqi-nafsi");

  const victim = await db.collection("users").insertOne({ role: "VICTIM", pseudonym: "v-debug", createdAt: new Date() });
  const counselor = await db.collection("users").insertOne({ role: "COUNSELOR", pseudonym: "c-debug", createdAt: new Date() });
  await db.collection("counselors").insertOne({ userId: counselor.insertedId, fullName: "د. تشخيص", lateCount: 0, createdAt: new Date() });
  await db.collection("sessions").insertOne({
    victimId: victim.insertedId,
    counselorId: counselor.insertedId,
    topic: "grief",
    mode: "TEXT",
    status: "PENDING",
    lateFlagged: false,
    createdAt: new Date(Date.now() - 40 * 3600000),
    updatedAt: new Date(Date.now() - 40 * 3600000),
  });

  await req("POST", "/api/admin", { action: "overdue-requests" });
  let s = await db.collection("sessions").findOne({});
  let p = await db.collection("counselors").findOne({});
  console.log("after sweep#1: lateFlagged =", s.lateFlagged, "| lateCount =", p.lateCount);

  await req("POST", "/api/admin", { action: "overdue-requests" });
  s = await db.collection("sessions").findOne({});
  p = await db.collection("counselors").findOne({});
  console.log("after sweep#2: lateFlagged =", s.lateFlagged, "| lateCount =", p.lateCount);

  server.kill("SIGKILL");
  await mongod.stop();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
