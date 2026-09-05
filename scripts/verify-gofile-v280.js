/* التحقق النهائي: تنزيل حزمة v2.8.0 من رابط gofile الجديد والتحقق من md5 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ acceptDownloads: true, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" });
  const page = await ctx.newPage();
  await page.goto("https://gofile.io/d/p0EZzYSt", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  const btn = page.locator('button:has-text("Download"), a:has-text("Download"), [aria-label*="ownload"]').first();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 120000 }),
    btn.click({ timeout: 15000 }),
  ]);
  const path = await download.path();
  const size = fs.statSync(path).size;
  console.log("نُزّل من gofile:", download.suggestedFilename(), size, "bytes");
  const { execSync } = require("child_process");
  const md5 = execSync(`md5sum "${path}"`).toString().split(" ")[0];
  console.log("md5:", md5);
  console.log(md5 === "0d0069bab39b9a2a72d7703a4e9516bb" ? "✅ مطابق للمحلي" : "❌ غير مطابق!");
  await browser.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
