/* التحقق النهائي: تنزيل حزمة v2.9.0 من رابط gofile الجديد والتحقق من md5 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ acceptDownloads: true, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" });
  const page = await ctx.newPage();
  await page.goto("https://gofile.io/d/unqDHO8Y", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(9000);
  /* لقطة تشخيصية */
  await page.screenshot({ path: "screens/gofile-v290-page.png" });
  let btn = page.locator('button:has-text("Download"), a:has-text("Download"), [aria-label*="ownload"]').first();
  if (!(await btn.isVisible().catch(() => false))) {
    /* بعض الواجهات تطلب قبول الكوكيز أولاً */
    const cmp = page.locator('button:has-text("Accept"), button:has-text("Agree")').first();
    if (await cmp.isVisible().catch(() => false)) { await cmp.click().catch(() => {}); await page.waitForTimeout(2500); }
    btn = page.locator('button:has-text("Download"), a:has-text("Download"), [aria-label*="ownload"]').first();
  }
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
  console.log(md5 === "575a3e4a697dd81b60bb867397834a78" ? "✅ مطابق للمحلي" : "❌ غير مطابق!");
  await browser.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
