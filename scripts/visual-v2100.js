/**
 * تحقق بصري v2.10.0 — الحجز الأخضر، الدعاء النقي، التمرين، محادثة الإدارة، التجاوب
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = String(3300 + (process.pid % 300));
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = require("http").request(`${BASE}${path}`, {
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
function futureDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

(async () => {
  const mongod = await (require("mongodb-memory-server")).MongoMemoryServer.create();
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT, MONGODB_URI: mongod.getUri("rafiqi-visual"), ADMIN_PASSCODE: "vis-pass", NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASE}/api/health`); const j = await r.json(); if (j.version === "2.10.0") { console.log("server ready"); break; } } catch {} await wait(500); }

  /* ─── بيانات: أخصائي بجدول + متضرران + موعد محجوز ─── */
  const vA = (await req("POST", "/api/victim", { action: "register", pseudonym: "زيارة-أ", password: "pass-vis-123", recoveryPhrase: "عبارة أ", gender: "male" })).json.user;
  const vB = (await req("POST", "/api/victim", { action: "register", pseudonym: "زيارة-ب", password: "pass-vis-123", recoveryPhrase: "عبارة ب", gender: "female" })).json.user;
  const cReg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. بصري", email: `vis${Date.now()}@t.dz`, password: "pass-vis-123", recoveryPhrase: "عبارة الأخصائي البصرية",
    whatsapp: "0555999888", specialties: ["trauma"], languages: ["ar"], yearsExperience: 8,
    bio: "أخصائي نفسي معتمد بخبرة ثماني سنوات في علاج الصدمات النفسية والاضطرابات ما بعد الكوارث. عملت مع عدة فرق إنسانية في جنوب الجزائر، وأتبع نهج العلاج المعرفي السلوكي مع الجمع بين التقنيات الاسترخائية الحديثة. أؤمن بأن كل إنسان قادر على التجاوز حين يجد الرفيق المناسب في الوقت المناسب.",
  });
  if (!cReg.json?.userId) throw new Error("counselor register failed: " + JSON.stringify(cReg.json));
  const counselorId = cReg.json.userId;
  const avail = {}; for (let d = 0; d < 7; d++) avail[String(d)] = ["10:00", "11:00", "15:00"];
  await req("POST", "/api/counselor", { action: "set-availability", userId: counselorId, weeklyAvailability: avail });
  await req("POST", "/api/admin", { action: "login", passcode: "vis-pass" });
  const pend = (await req("POST", "/api/admin", { action: "pending-counselors" })).json;
  for (const p of pend.all || []) await req("POST", "/api/admin", { action: "verify", profileId: p.id });
  await req("POST", "/api/sessions", {
    victimId: vB.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: new Date(`${futureDate(1)}T10:00:00+01:00`).toISOString(), date: futureDate(1), slot: "10:00",
  });
  /* رسالة من المختص للإدارة لعرضها في صندوق الأدمين */
  await req("POST", "/api/messages", { threadKey: `admin:${counselorId}`, senderRole: "COUNSELOR", senderId: counselorId, senderName: "د. بصري", content: "مساء الخير، هل يمكن مراجعة طلب توثيق أحد المتضررين؟" });

  const browser = await chromium.launch();

  /* ─── 1) نافذة الحجز — سطح المكتب: الأخضر والمحجوز ─── */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((user) => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.user = user; s.state.view = "victim-find"; s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  }, vA);
  await page.reload({ waitUntil: "networkidle" });
  await wait(1800);
  await page.keyboard.press("Escape");
  await wait(700);
  const cards = await page.$$("div.grid button.gradient-primary");
  if (cards.length) { await cards[0].click(); await wait(2000); }
  await page.screenshot({ path: "screens/v2100-01-booking-green.png" });
  const slotStates = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog']");
    if (!dlg) return null;
    return [...dlg.querySelectorAll("button")].filter((b) => /^\d{2}:\d{2}/.test(b.textContent.trim())).map((b) => ({ t: b.textContent.trim().slice(0, 8), disabled: b.disabled }));
  });
  console.log("booking slots:", JSON.stringify(slotStates));
  await page.close();

  /* ─── 2) نافذة الحجز — هاتف ─── */
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await mob.goto(BASE, { waitUntil: "domcontentloaded" });
  await mob.evaluate((user) => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.user = user; s.state.view = "victim-find"; s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  }, vA);
  await mob.reload({ waitUntil: "networkidle" });
  await wait(1800);
  await mob.keyboard.press("Escape");
  await wait(700);
  const mobCards = await mob.$$("div.grid button.gradient-primary");
  if (mobCards.length) { await mobCards[0].click(); await wait(2000); }
  await mob.screenshot({ path: "screens/v2100-02-booking-mobile.png" });
  await mob.close();

  /* ─── 3) الدعاء النقي ─── */
  const dua = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await dua.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await dua.goto(BASE, { waitUntil: "domcontentloaded" });
  await dua.evaluate(() => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.view = "dua"; s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  });
  await dua.reload({ waitUntil: "networkidle" });
  await wait(1800);
  await dua.keyboard.press("Escape");
  await wait(600);
  const amenVisible = await dua.evaluate(() => document.body.innerText.includes("آمين") || document.body.innerText.includes("نسخ / مشاركة"));
  console.log("dua page has amen/copy?", amenVisible);
  await dua.screenshot({ path: "screens/v2100-03-dua-clean.png" });
  await dua.close();

  /* ─── 4) التمرين: الخطوات + المدة (سطح المكتب — زر الهيدر يظهر ≥sm) ─── */
  const br = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await br.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await br.goto(BASE, { waitUntil: "networkidle" });
  await wait(1500);
  await br.keyboard.press("Escape");
  await wait(700);
  const brBtn = await br.$("button[title*='تمرين']");
  if (brBtn) { await brBtn.click(); await wait(900); }
  await br.screenshot({ path: "screens/v2100-04-breathing-steps.png" });
  const dur5 = await br.$("button:has-text('5:00')");
  if (dur5) { await dur5.click(); await wait(3400); }
  await br.screenshot({ path: "screens/v2100-05-breathing-running.png" });
  await br.close();

  /* ─── 5) الدليل: النبذة كاملة ─── */
  const dir = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await dir.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await dir.goto(BASE, { waitUntil: "domcontentloaded" });
  await dir.evaluate(() => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.view = "counselors-directory"; s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  });
  await dir.reload({ waitUntil: "networkidle" });
  await wait(1800);
  await dir.keyboard.press("Escape");
  await wait(600);
  const bioOk = await dir.evaluate(() => document.body.innerText.includes("أؤمن بأن كل إنسان قادر على التجاوز"));
  console.log("directory bio full?", bioOk);
  await dir.screenshot({ path: "screens/v2100-06-directory-bio.png" });
  await dir.close();

  /* ─── 6) المختص: صفحة التواصل مع الإدارة ─── */
  const cPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await cPage.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  const cLogin = (await req("POST", "/api/counselor", { action: "login", email: "", password: "" }));
  await cPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await cPage.evaluate((uid) => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.user = { id: uid, role: "COUNSELOR", fullName: "د. بصري" };
    s.state.view = "admin-chat"; s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  }, counselorId);
  await cPage.reload({ waitUntil: "networkidle" });
  await wait(1800);
  await cPage.keyboard.press("Escape");
  await wait(700);
  await cPage.screenshot({ path: "screens/v2100-07-admin-chat.png" });
  /* أرسل رسالة من الواجهة */
  const inp = await cPage.$("input[placeholder*='الإدارة']");
  if (inp) { await inp.fill("شكراً، في انتظار ردكم"); await cPage.keyboard.press("Enter"); await wait(1500); }
  await cPage.screenshot({ path: "screens/v2100-08-admin-chat-sent.png" });
  await cPage.close();

  /* ─── 7) الإدارة: تبويب رسائل المختصين + الرد ─── */
  const adm = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await adm.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await adm.goto(BASE, { waitUntil: "domcontentloaded" });
  const adminUser = (await req("POST", "/api/admin", { action: "login", passcode: "vis-pass" })).json.user;
  await adm.evaluate((au) => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.user = { id: au.id, role: "ADMIN" };
    s.state.view = "admin-panel"; s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  }, adminUser);
  await adm.reload({ waitUntil: "networkidle" });
  await wait(1800);
  await adm.keyboard.press("Escape");
  await wait(700);
  const inboxTab = await adm.$("button[role='tab']:has-text('رسائل المختصين')");
  if (inboxTab) { await inboxTab.click(); await wait(1500); }
  await adm.screenshot({ path: "screens/v2100-09-admin-inbox.png" });
  const threadCard = await adm.$("text=د. بصري");
  if (threadCard) { await threadCard.click(); await wait(2000); }
  const admInp = await adm.$("input[placeholder*='الإدارة']");
  if (admInp) { await admInp.fill("تمت المراجعة، شكراً لتنبيهك"); await adm.keyboard.press("Enter"); await wait(1500); }
  await adm.screenshot({ path: "screens/v2100-10-admin-reply.png" });
  await adm.close();

  /* ─── 8) عبارة الاطمئنان بالتركية ─── */
  const tr = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await tr.addInitScript(() => { localStorage.setItem("rafiqi-lang", "tr"); localStorage.setItem("rafiqi-sounds", "off"); });
  await tr.goto(BASE, { waitUntil: "networkidle" });
  await wait(1500);
  await tr.screenshot({ path: "screens/v2100-11-quote-tr.png" });
  await tr.close();

  await browser.close();
  server.kill("SIGKILL");
  await mongod.stop();
  console.log("VISUAL DONE");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
