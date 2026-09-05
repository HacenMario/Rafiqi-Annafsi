/* تحقق بصري حي لـ v2.8.0 — لقطات الميزات الجديدة على 390×844 و1280×800 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");

const PORT = 3777;
const BASE = `http://localhost:${PORT}`;
const shot = async (page, name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screens/v280-${name}.png`, fullPage: false });
  console.log(`  📸 v280-${name}.png`);
};

(async () => {
  fs.mkdirSync("screens", { recursive: true });
  const mongod = await MongoMemoryServer.create();
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT), MONGODB_URI: mongod.getUri("rafiqi-visual"), ADMIN_PASSCODE: "v280-visual", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const http = require("http");
  for (let i = 0; i < 60; i++) {
    try {
      await new Promise((res, rej) => http.get(`${BASE}/api/health`, (r) => { r.statusCode === 200 ? res() : rej(); }).on("error", rej));
      break;
    } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  console.log("🟢 الخادم جاهز");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  /* 1) الهبوط: زر هام جدا في الشريط العلوي */
  await page.goto(`${BASE}/?lang=ar`, { waitUntil: "networkidle" });
  await shot(page, "01-landing-important-btn");
  const importantBtn = page.locator("header button", { hasText: "هام جدا" }).first();
  console.log("  زر هام جدا ظاهر:", await importantBtn.count());

  /* 2) نافذة الإرشادات */
  await importantBtn.click();
  await shot(page, "02-important-dialog");
  await page.keyboard.press("Escape");

  /* 3) صفحة المؤسسين */
  await page.goto(`${BASE}/?lang=ar`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const w = window;
    // افتح عبر القائمة: الصفحة تُسجَّل كعرض founders في المتجر
    document.cookie = "";
  });
  await page.evaluate(() => fetch("/api/founders").then((r) => r.json()));
  // عبر واجهة المستخدم: زر الفوتر
  const foundersBtn = page.locator("footer button", { hasText: "مؤسسو المنصة" }).first();
  if (await foundersBtn.count()) {
    await foundersBtn.click();
    await shot(page, "03-founders-page");
  }

  /* 4) حساب أخصائي متجر في localStorage مع طلبات */
  await page.evaluate(() => localStorage.removeItem("rafiqi-state"));
  await page.goto(`${BASE}/?lang=ar`, { waitUntil: "networkidle" });

  /* 5) سطح المكتب: لوحة الأدمين */
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "ar" });
  const dpage = await dctx.newPage();
  await dpage.goto(`${BASE}/?lang=ar`, { waitUntil: "networkidle" });
  await dpage.evaluate(() => {
    const { useApp } = window;
  });
  // دخول الإدارة عبر الواجهة
  await dpage.locator("footer button", { hasText: "دخول الإدارة" }).first().click();
  await shot(dpage, "04-admin-login");
  await dpage.locator('input[type="password"]').fill("v280-visual");
  await dpage.locator("button", { hasText: "دخول" }).last().click();
  await dpage.waitForTimeout(2500);
  await shot(dpage, "05-admin-panel-refresh");

  console.log("  أخطاء الصفحة:", errors.length ? errors.slice(0, 3) : "لا شيء ✓");

  await browser.close();
  server.kill("SIGKILL");
  await mongod.stop();
  process.exit(0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
