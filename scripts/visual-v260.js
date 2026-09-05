/**
 * فحص بصري v2.6.0 — يزرع بيئة كاملة ثم يلتقط لقطات للمسارات الجديدة:
 *  1) نافذة الشرح + خطوة المواعيد (الخيار الأول)  2) نتائج المطابقة
 *  3) نافذة الحجز بمواعيد الأخصائي (الخيار الثاني)  4) شبكة الجدول في الإعدادات
 *  5) الأدمين: لافتة 36 ساعة + نافذة الطلبات المعلقة + أزرار التفعيل
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const http = require("http");
const { MongoClient, ObjectId } = require("mongodb");
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:3120";
const EMAIL_A = `vis-a-${Date.now()}@rafiqi.dz`;
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => { let json = null; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json, text: buf }); });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync("screens", { recursive: true });
  const mongod = await MongoMemoryServer.create({ instance: { port: 27145, ip: "127.0.0.1" } });
  const uri = mongod.getUri("rafiqi-nafsi");
  const launch = new Date(Date.now() - 5 * 86400000).toISOString();
  const server = spawn("node", ["server.js", "--prod"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3120", MONGODB_URI: uri, NODE_ENV: "production", ADMIN_PASSCODE: "rafiqi-admin-2026", V26_LAUNCH: launch },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await req("GET", "/api/health")).status === 200) break; } catch {}
    await wait(800);
  }
  console.log("server up");

  /* ─── زرع البيانات ─── */
  const grid = {};
  for (let d = 0; d < 7; d++) grid[String(d)] = ["09:00", "10:00", "13:00"];
  const regA = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. أمينة بوعلام", email: EMAIL_A,
    password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية طويلة", whatsapp: "0555123456",
    specialties: ["trauma", "grief"], languages: ["ar", "fr"], bio: "أخصائية نفسانية سريرية، 12 سنة خبرة في دعم ضحايا الكوارث.", yearsExperience: 12,
  });
  const userA = regA.json.userId;
  const meA = await req("GET", `/api/counselor?userId=${userA}`);
  await req("POST", "/api/admin", { action: "login", passcode: "rafiqi-admin-2026" });
  await req("POST", "/api/admin", { action: "verify", profileId: meA.json.profile.id });
  await req("POST", "/api/counselor", { action: "set-availability", userId: userA, weeklyAvailability: grid });

  const regB = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. بلال مهداوي", email: `vis-b-${Date.now()}@rafiqi.dz`,
    password: "testpass1234", recoveryPhrase: "عبارة استرجاع تجريبية طويلة", whatsapp: "0555987654",
    specialties: ["anxietyDepression"], languages: ["ar"], bio: "مختص في القلق والاكتئاب.", yearsExperience: 6,
  });
  const userB = regB.json.userId;
  const meB = await req("GET", `/api/counselor?userId=${userB}`);
  await req("POST", "/api/admin", { action: "verify", profileId: meB.json.profile.id });

  const vic = await req("POST", "/api/victim", { action: "register", pseudonym: "نجمة", password: "victimpass123", recoveryPhrase: "عبارة استرجاع تجريبية" });
  const victimId = vic.json.user.id;

  /* طلبان معلقان عاديان لـ A */
  const d2 = new Date(Date.now() + 2 * 86400000);
  const d2str = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
  await req("POST", "/api/sessions", { victimId, counselorId: userA, topic: "grief", mode: "TEXT", scheduledAt: new Date(`${d2str}T09:00:00`).toISOString(), date: d2str, slot: "09:00" });
  await req("POST", "/api/sessions", { victimId, counselorId: userA, topic: "safety", mode: "VOICE", scheduledAt: new Date(`${d2str}T10:00:00`).toISOString(), date: d2str, slot: "10:00" });

  /* طلب متأخر 40 ساعة (لافتة الأدمين) + مستخدم إدارة */
  const cli = new MongoClient(uri);
  await cli.connect();
  const db = cli.db("rafiqi-nafsi");
  await db.collection("users").insertOne({ role: "ADMIN", language: "ar", pseudonym: "الإدارة", createdAt: new Date() });
  await db.collection("sessions").insertOne({
    victimId: new ObjectId(victimId), counselorId: new ObjectId(userA), topic: "homeLoss", mode: "TEXT",
    status: "PENDING", lateFlagged: false, scheduledAt: new Date(Date.now() + 5 * 86400000),
    createdAt: new Date(Date.now() - 40 * 3600000), updatedAt: new Date(Date.now() - 40 * 3600000),
  });
  await cli.close();
  console.log("seeded");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
  const dump = async (tag) => {
    const info = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      let v = "?";
      try { v = JSON.parse(localStorage.getItem("rafiqi-state") || "{}")?.state?.view ?? "∅"; } catch {}
      return { keys: keys.join(","), v };
    });
    console.log(`[${tag}] view=${info.v} keys=${info.keys}`);
    await page.screenshot({ path: `screens/debug-${tag}.png` });
  };
  const shot = (name) => page.screenshot({ path: `screens/v260-${name}.png`, fullPage: false });
  const safeStep = async (tag, fn) => {
    try { await fn(); } catch (e) {
      console.log(`[FAIL ${tag}] ${String(e?.message || e).split("\n")[0]}`);
      await page.screenshot({ path: `screens/debug-fail-${tag}.png` }).catch(() => {});
      throw e;
    }
  };

  const dismissQuote = async () => {
    /* نافذة العبارة تُغلق بالنقر على الخلفية — ننتظرها ثم نغلقها إن ظهرت */
    try {
      await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 6000 });
      await page.mouse.click(30, 430);
      await wait(600);
    } catch { /* لم تظهر */ }
  };

  /* ─── 1) مسار المتضرر: دخول ← موضوع ← المواعيد (مع نافذة الشرح) ─── */
  await page.goto(BASE);
  await wait(2200);
  await dismissQuote();
  await dump("landing");
  /* من الهبوط ← «ابدأ رحلة التعافي» (أدوار) ← «اطلب الدعم» */
  await safeStep("landing-cta", () => page.getByRole("button", { name: /ابدأ رحلة التعافي/ }).first().click({ timeout: 15000 }));
  await wait(900);
  await dump("roles");
  await page.locator("main").getByRole("button", { name: "اطلب الدعم" }).first().click();
  await wait(1000);
  await dump("victim-start");
  /* تبويب تسجيل الدخول */
  await page.locator("main").getByRole("button", { name: "تسجيل الدخول" }).first().click();
  await wait(500);
  await page.locator("input").first().fill("نجمة");
  await page.locator('input[type="password"]').first().fill("victimpass123");
  await page.locator("main").getByRole("button", { name: "تسجيل الدخول" }).last().click();
  await wait(1400);
  /* الموضوعات → الخطوة الجديدة */
  await page.getByRole("button", { name: /فقدتُ عزيزاً/ }).first().click();
  await wait(1300);
  await shot("01-guide-popup");
  /* إغلاق يدوي للنافذة */
  await page.getByRole("button", { name: /فهمت/ }).click();
  await wait(600);
  /* اختيار يوم وساعتين */
  await page.locator("main button", { hasText: /\d{2}\/\d{2}/ }).first().click();
  await wait(400);
  await page.getByRole("button", { name: "09:00" }).first().click();
  await page.getByRole("button", { name: "13:00" }).first().click();
  await wait(500);
  await shot("02-slots-picked");
  /* متابعة → نتائج المطابقة */
  await page.getByRole("button", { name: /اعرض الأخصائيين المتوفرين/ }).click();
  await wait(2200);
  await shot("03-matched-results");

  /* حجز من نتيجة مطابقة — نافذة الحجز بالموعد المميز */
  const bookButtons = page.getByRole("button", { name: /احجز جلسة/ });
  await bookButtons.first().click();
  await wait(1200);
  await shot("04-booking-highlight");
  await page.keyboard.press("Escape");
  await wait(500);

  /* ─── 2) الخيار الثاني: الدليل ثم نافذة حجز بمواعيد الأخصائي ─── */
  await page.goto(`${BASE}?lang=fr`);
  await wait(1800);
  await dismissQuote();
  await page.getByRole("button", { name: /Spécialistes|Spécialiste/ }).first().click().catch(() => {});
  await wait(1800);
  await shot("05-directory-fr");
  const bookFr = page.getByRole("button", { name: /Réserver/ }).first();
  await bookFr.click();
  await wait(1200);
  await shot("06-booking-availability-fr");
  await page.keyboard.press("Escape");
  await wait(400);

  /* ─── 3) الإعدادات: شبكة الجدول الأسبوعي (أخصائي) ─── */
  await page.evaluate(() => { localStorage.removeItem("rafiqi-state"); localStorage.removeItem("rafiqi-lang"); });
  await page.goto(BASE);
  await wait(1800);
  await dismissQuote();
  await safeStep("counselor-cta", () => page.getByRole("button", { name: "أنا أخصائي نفسي متطوع" }).first().click({ timeout: 12000 }));
  await wait(900);
  await safeStep("counselor-login-link", () => page.getByRole("button", { name: "دخول الأخصائيين" }).first().click({ timeout: 12000 }));
  await wait(900);
  await page.locator('input[type="email"]').first().fill(EMAIL_A);
  await page.locator('input[type="password"]').first().fill("testpass1234");
  await safeStep("counselor-login-submit", () => page.locator("main").getByRole("button", { name: "دخول" }).last().click({ timeout: 12000 }));
  await wait(1800);
  await safeStep("settings-nav", () => page.getByRole("button", { name: "الإعدادات" }).first().click({ timeout: 12000 }));
  await wait(1500);
  await shot("07-settings-grid");
  await page.getByRole("button", { name: /السبت/ }).first().scrollIntoViewIfNeeded().catch(() => {});
  await shot("08-settings-grid-bottom");

  /* ─── 4) الأدمين: اللافتة + الطلبات + التفعيل ─── */
  await page.evaluate(() => { localStorage.removeItem("rafiqi-state"); localStorage.removeItem("rafiqi-lang"); });
  await page.goto(BASE);
  await wait(1800);
  await dismissQuote();
  await safeStep("admin-footer", () => page.locator("footer").getByRole("button", { name: "دخول الإدارة" }).first().click({ timeout: 12000 }));
  await wait(1200);
  await page.locator('input[type="password"]').first().fill("rafiqi-admin-2026");
  await page.locator("main").getByRole("button", { name: "دخول" }).last().click();
  await wait(2600);
  await shot("09-admin-overdue-banner");
  await page.getByRole("tab", { name: /الحسابات/ }).click();
  await wait(2200);
  try {
    await page.locator("button", { hasText: "الطلبات" }).first().waitFor({ timeout: 20000 });
  } catch (e) {
    await page.screenshot({ path: "screens/debug-admin-full.png", fullPage: true }).catch(() => {});
    throw e;
  }
  const rowCount = await page.locator("button", { hasText: "الطلبات" }).count();
  console.log(`[admin] requests buttons found = ${rowCount}`);
  await shot("10-admin-accounts-buttons");
  await page.screenshot({ path: "screens/v260-10b-accounts-full.png", fullPage: true });
  await page.locator("button", { hasText: "الطلبات" }).last().click();
  await wait(1300);
  await shot("11-admin-requests-dialog");

  await browser.close();
  server.kill("SIGKILL");
  await mongod.stop().catch(() => {});
  console.log("visual QA done");
  process.exit(0);
}

main().catch(async (e) => {
  console.error("💥", e?.message || e);
  try {
    const { chromium } = require("playwright");
    const b = await chromium.launch();
    const pg = await b.newPage({ viewport: { width: 1180, height: 860 } });
    await pg.goto("http://localhost:3120").catch(() => {});
    await pg.waitForTimeout(2500);
    await pg.screenshot({ path: "screens/debug-fail.png" }).catch(() => {});
    await b.close();
  } catch {}
  process.exit(1);
});
