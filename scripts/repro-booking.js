/**
 * إعادة إنتاج خطأ الحجز — نافذة حجز جلسة مع المختص
 * S1: أخصائي بجدول توفر (10:00, 11:00 فقط كل يوم) + موعد محجوز من متضرر آخر
 * S2: متضرر بانتظار توثيق الحرائق
 */
const { chromium } = require("playwright");
const http = require("http");

const BASE = "http://localhost:3000";

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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function futureDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

(async () => {
  /* ─── تهيئة البيانات ─── */
  const stamp = Date.now().toString(36);
  const vA = (await req("POST", "/api/victim", { action: "register", pseudonym: `متضرر-أ-${stamp}`, password: "pass-repro-123", recoveryPhrase: "عبارة استرجاع أ", gender: "male" })).json.user;
  const vB = (await req("POST", "/api/victim", { action: "register", pseudonym: `متضرر-ب-${stamp}`, password: "pass-repro-123", recoveryPhrase: "عبارة استرجاع ب", gender: "female" })).json.user;
  console.log("victims:", vA?.id, vB?.id);

  const cReg = await req("POST", "/api/counselor", {
    action: "register", fullName: "د. تجربة التوفر", email: `repro${Date.now()}@t.dz`, password: "pass-repro-123", recoveryPhrase: "عبارة أخصائي",
    whatsapp: "0555112233", specialties: ["trauma"], languages: ["ar"], yearsExperience: 6,
  });
  const cLogin = (await req("POST", "/api/counselor", { action: "login", email: cReg.json ? cReg.json.userId ? "x" : "x" : "x", password: "x" }));
  console.log("counselor register:", JSON.stringify(cReg.json).slice(0, 200));
  const counselorId = cReg.json?.userId;

  /* جدول توفر: كل الأيام 10:00 و 11:00 و 15:00 فقط */
  const avail = {};
  for (let d = 0; d < 7; d++) avail[String(d)] = ["10:00", "11:00", "15:00"];
  const saved = await req("POST", "/api/counselor", { action: "set-availability", userId: counselorId, weeklyAvailability: avail });
  console.log("availability saved:", JSON.stringify(saved.json?.weeklyAvailability));

  /* الأدمين يوثّق الأخصائي */
  await req("POST", "/api/admin", { action: "login", passcode: "repro-admin" });
  const pend = (await req("POST", "/api/admin", { action: "pending-counselors" })).json;
  for (const p of pend.all || []) await req("POST", "/api/admin", { action: "verify", profileId: p.id });

  /* متضرر ب يحجز 10:00 غداً (يصبح محجوزاً) */
  const book = await req("POST", "/api/sessions", {
    victimId: vB.id, counselorId, topic: "trauma", mode: "TEXT",
    scheduledAt: new Date(`${futureDate(1)}T10:00:00+01:00`).toISOString(), date: futureDate(1), slot: "10:00",
  });
  console.log("vB booking:", JSON.stringify(book.json));

  const list = (await req("GET", "/api/counselors")).json.counselors || [];
  const c = list.find((x) => x.userId === counselorId);
  console.log("counselor in list:", c ? `avail=${JSON.stringify(c.weeklyAvailability)}` : "MISSING");

  const taken = (await req("GET", `/api/taken-slots?counselorId=${counselorId}&days=21`)).json;
  console.log("taken-slots:", JSON.stringify(taken));

  /* ─── المتصفح: متضرر أ يفتح نافذة الحجز ─── */
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { window.__skipQuote = true; localStorage.setItem("rafiqi-sounds", "off"); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.evaluate((user) => {
    const raw = localStorage.getItem("rafiqi-state");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    s.state.user = user;
    s.state.view = "victim-find";
    s.version = 0;
    localStorage.setItem("rafiqi-state", JSON.stringify(s));
  }, vA);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "screens/repro-01-victim-find.png" });

  /* افتح نافذة الحجز مع الأخصائي */
  const bookBtn = await page.$(`button:has-text("د. تجربة التوفر")`);
  const cards = await page.$$("div.grid button.gradient-primary");
  console.log("found book buttons:", cards.length);
  if (cards.length) { await cards[0].click(); await wait(1800); }
  await page.screenshot({ path: "screens/repro-02-booking-dialog.png" });

  /* جرّب الضغط على كل الأزرار الزمنية وسجّل أيها معطّل */
  const slotStates = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog']");
    if (!dlg) return "NO DIALOG";
    const btns = [...dlg.querySelectorAll("button")].filter((b) => /^\d{2}:\d{2}/.test(b.textContent.trim()));
    return btns.map((b) => ({ t: b.textContent.trim().slice(0, 8), disabled: b.disabled, cls: b.className.slice(0, 80) }));
  });
  console.log("slot states:", JSON.stringify(slotStates, null, 1));

  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
