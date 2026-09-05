/* استرجاع v2.7.0 من gofile — الضغط على زر التنزيل داخل الصفحة الحية */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", acceptDownloads: true });
  const page = await ctx.newPage();

  await page.goto("https://gofile.io/d/YN9rFymD", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  // زر التنزيل في واجهة gofile
  const btn = page.locator('button:has-text("Download"), a:has-text("Download"), [aria-label*="ownload"], button[id*="download"]').first();
  console.log("[1] زر التنزيل موجود:", await btn.count());
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 120000 }),
    btn.click({ timeout: 15000 }),
  ]);
  const path = await download.path();
  const suggested = download.suggestedFilename();
  console.log("[2] نُزّل:", suggested, fs.statSync(path).size, "bytes");

  const out = "/home/z/my-project/download/Rafiqi-Annafsi-v2.7.0.zip";
  fs.copyFileSync(path, out);
  console.log("[3] حُفظ:", out);
  await browser.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
