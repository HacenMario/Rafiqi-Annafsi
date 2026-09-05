/* تحقق بصري 2: لوحة الأخصائي (الاسم المستعار + الأزرار) + لوحة الأدمين (التبويبات) + نافذة الحجز */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");
const http = require("http");

const PORT = 3778;
const BASE = `http://localhost:${PORT}`;
const shot = async (page, name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screens/v280-${name}.png` });
  console.log(`  📸 v280-${name}.png`);
};

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let buf = ""; res.on("data", (c) => (buf += c)); res.on("end", () => { let j = null; try { j = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on("error", reject); if (data) r.write(data); r.end();
  });
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT), MONGODB_URI: mongod.getUri("rafiqi-v2"), ADMIN_PASSCODE: "v280-visual", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 60; i++) { try { await new Promise((res, rej) => http.get(`${BASE}/api/health`, (r) => { r.statusCode === 200 ? res() : rej(); }).on("error", rej)); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
  console.log("🟢 الخادم جاهز");

  /* بيانات حية: أخصائي موثّق + متضرر + طلب معلّق */
  const reg = await req("POST", "/api/counselor", { action: "register", fullName: "د. سميرة تجربة", email: `dr-${Date.now()}@v.dz`, password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية", whatsapp: "0555123456", specialties: ["trauma"], languages: ["ar"], yearsExperience: 7 });
  const counselorId = reg.json?.userId;
  const { MongoClient } = require("mongodb");
  const mc = new MongoClient(mongod.getUri());
  await mc.connect();
  await mc.db().collection("counselors").updateOne({ userId: counselorId }, { $set: { verificationStatus: "VERIFIED" } });
  const vic = await req("POST", "/api/victim", { action: "register", pseudonym: "زينب الحسرة", password: "victimpass123", recoveryPhrase: "عبارة استرجاع صحيحة", phone: "0555112233" });
  const victimId = vic.json?.user?.id;
  const d = new Date(); d.setDate(d.getDate() + 2);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await req("POST", "/api/sessions", { victimId, counselorId, topic: "grief", mode: "TEXT", scheduledAt: new Date(`${dateStr}T10:00:00+01:00`).toISOString(), date: dateStr, slot: "10:00" });
  console.log("بيانات جاهزة: أخصائي + متضرر + طلب معلّق");

  const browser = await chromium.launch({ headless: true });

  /* ── لوحة الأخصائي ── */
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "ar" });
  const cpage = await cctx.newPage();
  await cpage.addInitScript((user) => {
    localStorage.setItem("rafiqi-state", JSON.stringify({ state: { user, view: "counselor-dashboard" }, version: 0 }));
  }, { id: counselorId, role: "COUNSELOR", fullName: "د. سميرة تجربة", email: "dr@v.dz", verified: true });
  await cpage.goto(`${BASE}/?lang=ar`, { waitUntil: "networkidle" });
  await cpage.waitForTimeout(8000); /* نافذة الترحيب تختفي تلقائياً بعد 7 ثوانٍ */
  await shot(cpage, "06-dashboard-alias-buttons");

  /* نافذة القبول بالمدة */
  const acceptBtn = cpage.locator("button", { hasText: "قبول" }).first();
  if (await acceptBtn.count()) {
    await acceptBtn.click();
    await shot(cpage, "07-accept-duration-dialog");
    await cpage.keyboard.press("Escape");
  }

  /* نافذة الاعتذار بسبب */
  const declineBtn = cpage.locator("button", { hasText: "اعتذار" }).first();
  if (await declineBtn.count()) {
    await declineBtn.click();
    await shot(cpage, "08-decline-reason-dialog");
    await cpage.keyboard.press("Escape");
  }

  /* نافذة المحادثة (تواصل) */
  const dmBtn = cpage.locator("button", { hasText: "تواصل" }).first();
  if (await dmBtn.count()) {
    await dmBtn.click();
    await cpage.waitForTimeout(800);
    await shot(cpage, "09-dm-dialog");
    await cpage.keyboard.press("Escape");
  }

  /* ── لوحة الأدمين: التبويبات الجديدة ── */
  const actx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "ar" });
  const apage = await actx.newPage();
  await apage.goto(`${BASE}/?lang=ar`, { waitUntil: "networkidle" });
  await apage.locator("footer button", { hasText: "دخول الإدارة" }).first().click();
  await apage.locator('input[type="password"]').fill("v280-visual");
  await apage.locator('input[type="password"]').press("Enter");
  await apage.waitForTimeout(3500);
  const cancelledTab = apage.locator('button[role="tab"]', { hasText: "الطلبات الملغاة" });
  console.log("  تبويب الملغاة موجود:", await cancelledTab.count());
  console.log("  تبويب الإشعار الجماعي:", await apage.locator('button[role="tab"]', { hasText: "إشعار جماعي" }).count());
  console.log("  تبويب المؤسسون:", await apage.locator('button[role="tab"]', { hasText: "المؤسسون" }).count());
  console.log("  زر تحديث اللوحة:", await apage.locator("button", { hasText: "تحديث اللوحة" }).count());
  await shot(apage, "10-admin-tabs");
  if (await cancelledTab.count()) {
    await cancelledTab.click();
    await apage.waitForTimeout(1200);
    await shot(apage, "11-admin-cancelled-tab");
  }
  const bulkTab = apage.locator('button[role="tab"]', { hasText: "إشعار جماعي" }).first();
  if (await bulkTab.count()) {
    await bulkTab.click();
    await apage.waitForTimeout(800);
    await shot(apage, "12-admin-bulk-tab");
  }
  const foundersTab = apage.locator('button[role="tab"]', { hasText: "المؤسسون" }).first();
  if (await foundersTab.count()) {
    await foundersTab.click();
    await apage.waitForTimeout(800);
    await shot(apage, "13-admin-founders-tab");
  }

  await browser.close();
  await mc.close();
  server.kill("SIGKILL");
  await mongod.stop();
  process.exit(0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
