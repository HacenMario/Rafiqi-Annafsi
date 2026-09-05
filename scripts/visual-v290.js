/** فحص بصري سريع لv2.9.0 — لقطات للواجهات الجديدة */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = String(3300 + (process.pid % 300));
const BASE = `http://localhost:${PORT}`;

(async () => {
  const mongod = await (require("mongodb-memory-server")).MongoMemoryServer.create();
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT, MONGODB_URI: mongod.getUri("rafiqi-visual"), ADMIN_PASSCODE: "v290-admin-pass", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASE}/api/health`); const j = await r.json(); if (j.version === "2.9.0") { console.log("server ready v2.9.0"); break; } } catch {} await new Promise((r) => setTimeout(r, 500)); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const shot = (n) => page.screenshot({ path: `screens/v290-${n}.png`, fullPage: false });
  /* تهيئة قبل أي تحميل: لغة + إخفاء نافذة الاطمئنان */
  await page.addInitScript(() => {
    window.__skipQuote = true;
    localStorage.setItem("rafiqi-sounds", "off");
  });

  /* الرئيسية بالعربية */
  await page.goto(`${BASE}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await shot("01-landing-mobile-ar");

  /* الدعاء */
  await page.evaluate(() => { const st = window; });
  await page.evaluate(() => { const el = document.querySelector("button[aria-label]"); });
  /* الانتقال عبر zustand مباشرة غير ممكن من الصفحة — نستعمل التخزين: نضبط view عبر localStorage */
  await page.goto(`${BASE}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const raw = localStorage.getItem("rafiqi-state");
    if (raw) { const s = JSON.parse(raw); s.state.view = "dua"; s.version = 0; localStorage.setItem("rafiqi-state", JSON.stringify(s)); }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await shot("02-dua-mobile-ar");

  /* الرئيسية بالتركية والروسية والصينية — اللغة تُضبط قبل التحميل */
  const openIn = async (lng, n) => {
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p2.addInitScript((l) => {
      localStorage.setItem("rafiqi-lang", l);
      localStorage.setItem("rafiqi-sounds", "off");
    }, lng);
    await p2.goto(BASE, { waitUntil: "networkidle" });
    await p2.waitForTimeout(900);
    await p2.keyboard.press("Escape");
    await p2.waitForTimeout(700);
    await p2.screenshot({ path: `screens/v290-${n}.png` });
    await p2.close();
  };
  await openIn("tr", "03-landing-mobile-tr");
  await openIn("ru", "04-landing-mobile-ru");
  await openIn("zh", "05-landing-mobile-zh");

  /* الأدمين: لوحة القيادة */
  const admin = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await admin.goto(`${BASE}/?lang=ar`, { waitUntil: "domcontentloaded" });
  await admin.evaluate(() => {
    const raw = localStorage.getItem("rafiqi-state");
    if (raw) { const s = JSON.parse(raw); s.state.view = "admin-login"; s.state.user = { id: "admin-local", role: "ADMIN" }; localStorage.setItem("rafiqi-state", JSON.stringify(s)); }
  });
  await admin.reload({ waitUntil: "networkidle" });
  await admin.waitForTimeout(1200);
  /* افتح لوحة القيادة عبر الظبط على tab "dashboard" */
  const dashTrigger = await admin.$("button[role='tab']:has-text('لوحة القيادة')");
  if (dashTrigger) { await dashTrigger.click(); await admin.waitForTimeout(1500); }
  await admin.screenshot({ path: "screens/v290-06-admin-dashboard.png" });

  await browser.close();
  server.kill("SIGKILL");
  await mongod.stop();
  console.log("visual smoke done");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
