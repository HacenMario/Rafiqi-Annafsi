"use client";

import { useCallback, useRef, useState } from "react";
import { Download } from "lucide-react";

/* زر تحميل الشهادة — v2.5.5
   ❗ إصلاح جذري: كانت الطباعة تعتمد على حوار الطباعة (window.print / iframe)
   ولا يعمل بثبات على أندرويد/PWA وبعض المتصفحات. الآن يولّد الزر ملف PDF
   حقيقي ويُنزَّل مباشرة بلا أي حوار:
   1) html-to-image يحوّل ورقة الشهادة إلى صورة عالية الدقة عبر foreignObject
      — المتصفح نفسه من يرسم، فتُدعَم العربية وRTL والألوان الحديثة بدقة تامة.
   2) jsPDF يضع الصورة في ورقة A4 عرضية (مع احتواء الحفاظ على النسبة) وينزّلها.
   عند أي فشل نادر نعود تلقائياً لطريقة v2.5.4 (طباعة عبر iframe مستقل). */
export function PrintButton({ label }: { label: string }) {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  /* ── الاحتياط: طباعة عبر iframe مستقل يُبنى في كل ضغطة (v2.5.4) ── */
  const printViaIframe = useCallback(() => {
    try {
      const sheet = document.querySelector(".certificate-sheet");
      if (!sheet) throw new Error("certificate-sheet not found");

      /* جمع أنماط الصفحة الحالية (Tailwind + أنماط مضمّنة) لنسخها داخل الإطار */
      const head: string[] = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
        const href = (l as HTMLLinkElement).href;
        if (href) head.push(`<link rel="stylesheet" href="${href}">`);
      });
      document.querySelectorAll("style").forEach((s) => {
        if (s.textContent) head.push(`<style>${s.textContent}</style>`);
      });
      /* قواعد الطباعة نفسها لكن بلا @media — تُطبق دائماً داخل الإطار */
      head.push(
        `<style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}.certificate-sheet{max-width:none!important;border-radius:0!important;box-shadow:none!important;width:100%;min-height:100vh}</style>`
      );

      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(frame);

      const doc = frame.contentDocument;
      if (!doc) throw new Error("iframe document unavailable");
      doc.open();
      doc.write(
        `<!DOCTYPE html><html dir="${document.documentElement.getAttribute("dir") || "rtl"}"><head><meta charset="utf-8"><title>${document.title}</title>${head.join("")}</head><body>${sheet.outerHTML}</body></html>`
      );
      doc.close();

      let fired = false;
      const go = () => {
        if (fired) return;
        fired = true;
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => frame.remove(), 1500);
      };
      frame.onload = () => setTimeout(go, 150);
      setTimeout(go, 900);
    } catch {
      /* آخر احتياط — الطباعة المباشرة */
      window.print();
    }
  }, []);

  /* ── الأساس: توليد ملف PDF وتنزيله مباشرة ── */
  const download = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const sheet = document.querySelector(".certificate-sheet") as HTMLElement | null;
      if (!sheet) throw new Error("certificate-sheet not found");

      /* تحميل مكوّني الرسم عند الطلب فقط (لا يؤثران على سرعة فتح الصفحة) */
      const [{ toPng }, jsPDFModule] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const { jsPDF } = jsPDFModule;

      /* v2.8.0: pixelRatio 2 + تحديد أقصى للعرض — كان 3 يفشل على بعض
         حواسيب الحاسوب بسبب حدود حجم الـ canvas فيتوقف الزر بلا أي شيء */
      const dataUrl = await toPng(sheet, {
        pixelRatio: 2,
        backgroundColor: "#FFFDF6",
        cacheBust: true,
      });

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const props = pdf.getImageProperties(dataUrl);
      const ratio = props.width / props.height;
      let w = pageW;
      let h = pageW / ratio;
      if (h > pageH) {
        h = pageH;
        w = pageH * ratio;
      }
      pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, "FAST");
      pdf.save("rafiqi-certificate.pdf");
    } catch (e) {
      console.error("[CERT] فشل توليد PDF — نحوّل للطباعة الاحتياطية:", e);
      /* أي فشل (ذاكرة/خط شبكة/خطوط) → طريقة الطباعة الاحتياطية ثم الطباعة المباشرة */
      try {
        printViaIframe();
      } catch {
        try {
          window.print();
        } catch {
          alert("تعذر تحميل الشهادة — أعد المحاولة أو استعمل متصفحاً آخر");
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [printViaIframe]);

  return (
    <div className="no-print fixed bottom-5 inset-x-0 z-50 flex justify-center px-4">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl bg-teal-700 text-white px-7 py-3.5 text-sm font-black shadow-xl hover:bg-teal-600 transition-colors disabled:opacity-70"
      >
        <Download className="h-4.5 w-4.5" />
        {label}
      </button>
    </div>
  );
}
