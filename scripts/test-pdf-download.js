/* اختبار تنزيل PDF فعلي من صفحة الشهادة — v2.5.5 */
const { MongoMemoryServer } = require("/home/z/my-project/node_modules/mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { chromium } = require("/home/z/.npm-global/lib/node_modules/playwright");
const fs = require("fs");
const PORT = 3121;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`http://localhost:${PORT}${path}`, { method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let buf = ""; res.on("data", c => buf += c);
      res.on("end", () => { let json; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json, text: buf }); });
    });
    r.on("error", reject); if (data) r.write(data); r.end();
  });
}

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27151, ip: "127.0.0.1" } });
  const server = spawn("node", ["server.js", "--prod"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT), MONGODB_URI: mongod.getUri("rafiqi"), NODE_ENV: "production", ADMIN_PASSCODE: "rafiqi-admin-2026" }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await req("GET", "/api/health")).status === 200) break; } catch {} await new Promise(r => setTimeout(r, 700)); }

  const stamp = Date.now();
  const reg = await req("POST", "/api/counselor", { action: "register", fullName: "Dr Amina Test", email: `pdf-${stamp}@rafiqi.dz`, password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية", whatsapp: "0555123456", specialties: ["trauma"], languages: ["ar"], yearsExperience: 5 });
  const userId = reg.json.userId;
  const me = await req("GET", `/api/counselor?userId=${userId}`);
  await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
  await req("POST", "/api/admin", { action: "verify", profileId: me.json.profile.id });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/certificate/${userId}`, { waitUntil: "networkidle" });
  /* انتظار اختفاء نافذة الترحيب */
  await page.waitForTimeout(1500);

  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page.click(".no-print button");
  const download = await downloadPromise;
  const path = "/tmp/cert-download-test.pdf";
  await download.saveAs(path);
  const size = fs.statSync(path).size;
  const head = fs.readFileSync(path).subarray(0, 5).toString();

  console.log("filename:", download.suggestedFilename());
  console.log("size:", size, "bytes");
  console.log("header:", head, head === "%PDF-" ? "(PDF صالح)" : "(غير صالح!)");
  console.log("page errors:", pageErrors.length ? pageErrors.slice(0, 5) : "لا شيء");

  await browser.close();
  server.kill("SIGKILL");
  await mongod.stop();
  if (head !== "%PDF-" || size < 30000 || pageErrors.length > 0) process.exit(1);
  console.log("🎉 زر التحميل يُنتج PDF حقيقياً بنجاح");
})().catch(e => { console.error("💥", e.message); process.exit(1); });
