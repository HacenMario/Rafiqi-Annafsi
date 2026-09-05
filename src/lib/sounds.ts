"use client";

/**
 * أصوات الواجهة — نغمات مولّدة عبر WebAudio (بدون ملفات صوتية)
 * ─────────────────────────────────────────────────────────────
 * click     نقرة خفيفة عند الضغط على الأزرار والروابط
 * navigate  نغمة تنقّل بين الصفحات
 * message   وصول رسالة جديدة داخل المحادثة
 * notify    وصول إشعار
 * success   نجاح عملية (حفظ/إرسال)
 * error     خطأ
 *
 * الإعداد محفوظ في localStorage: rafiqi-sounds = "on" | "off" (افتراضي on)
 * AudioContext يُفتح عند أول تفاعل من المستخدم (سياسة المتصفحات).
 */

export type SoundName = "click" | "navigate" | "message" | "notify" | "success" | "error";

const STORAGE_KEY = "rafiqi-sounds";

export function isSoundOn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundOn(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneSpec {
  freq: number;
  to?: number;
  dur: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
}

function playTones(tones: ToneSpec[]) {
  if (!isSoundOn()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") return; // لم يُفتح بعد بتفاعل مستخدم — نتجاهل بصمت
  const now = ac.currentTime;
  for (const t of tones) {
    try {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const start = now + (t.delay ?? 0);
      const end = start + t.dur;
      const vol = t.gain ?? 0.05;
      osc.type = t.type ?? "sine";
      osc.frequency.setValueAtTime(t.freq, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, end);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g).connect(ac.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    } catch {
      /* تجاهل */
    }
  }
}

/** تشغيل نغمة واجهة — آمن للاستدعاء من أي مكان */
export function playSound(name: SoundName) {
  switch (name) {
    case "click":
      playTones([{ freq: 620, to: 520, dur: 0.045, type: "triangle", gain: 0.035 }]);
      break;
    case "navigate":
      playTones([
        { freq: 494, dur: 0.07, type: "sine", gain: 0.04 },
        { freq: 740, dur: 0.09, delay: 0.06, type: "sine", gain: 0.045 },
      ]);
      break;
    case "message":
      playTones([{ freq: 660, to: 880, dur: 0.1, type: "sine", gain: 0.055 }]);
      break;
    case "notify":
      playTones([
        { freq: 880, dur: 0.12, type: "sine", gain: 0.06 },
        { freq: 1318, dur: 0.16, delay: 0.1, type: "sine", gain: 0.05 },
      ]);
      break;
    case "success":
      playTones([
        { freq: 523, dur: 0.08, type: "sine", gain: 0.045 },
        { freq: 659, dur: 0.08, delay: 0.07, type: "sine", gain: 0.045 },
        { freq: 784, dur: 0.12, delay: 0.14, type: "sine", gain: 0.05 },
      ]);
      break;
    case "error":
      playTones([{ freq: 240, to: 170, dur: 0.16, type: "sawtooth", gain: 0.03 }]);
      break;
  }
}

let lastClickAt = 0;
let installed = false;

/**
 * v2.9.0 — نغمة استرخاء قصيرة (≤10 ثوانٍ) مولّدة عبر WebAudio.
 * طبقة صوت هادئة من نغمات متناغمة (A3+C#4+E4+A4) مع تلاشٍ ناعم —
 * تُشغَّل بعد إغلاق نافذة الاطمئنان في الصفحة الرئيسية مباشرة.
 * لا تحتاج ملفات صوتية وتحترم إعداد أصوات الواجهة.
 */
export function playRelaxation(): void {
  if (!isSoundOn()) return;
  const ac = getCtx();
  if (!ac || ac.state === "suspended") return;
  const now = ac.currentTime;
  const dur = 9.5; /* أقل من 10 ثوانٍ */
  /* أربعة نغمات متناغمة كطبقة موسيقية دافئة */
  const chord = [
    { freq: 220.0, vol: 0.030 }, /* A3 */
    { freq: 277.18, vol: 0.024 }, /* C#4 */
    { freq: 329.63, vol: 0.024 }, /* E4 */
    { freq: 440.0, vol: 0.018 }, /* A4 */
  ];
  for (const c of chord) {
    try {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(c.freq, now);
      /* هزّة خفيفة جداً تجعل النغمة دافئة كالنَفَس */
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      lfo.frequency.setValueAtTime(0.18, now);
      lfoGain.gain.setValueAtTime(1.2, now);
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + dur + 0.2);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(c.vol, now + 1.8); /* دخول ناعم */
      g.gain.setValueAtTime(c.vol, now + dur - 2.6);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur); /* خروج هادئ */
      osc.connect(g).connect(ac.destination);
      osc.start(now);
      osc.stop(now + dur + 0.1);
    } catch {
      /* تجاهل */
    }
  }
}

/** تثبيت مستمع عام: نقرة خفيفة على كل زر/رابط — يُستدعى مرة واحدة من الـProviders */
export function initGlobalSounds() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest("button, a, [role='button'], [role='menuitem'], summary");
      if (!el) return;
      // عناصر معطّلة بلا صوت
      if ((el as HTMLButtonElement).disabled) return;
      const now = Date.now();
      if (now - lastClickAt < 70) return;
      lastClickAt = now;
      playSound("click");
    },
    { capture: true }
  );
}
