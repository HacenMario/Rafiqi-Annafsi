"use client";

/**
 * v2.10.0 — تمرين تهدئة النفس 4-4-6 بالمنطق الفعلي الكامل
 * ─────────────────────────────────────────────────────────────
 * خطوات التطبيق كما وردت من المستخدم حرفياً (مترجمة لكل اللغات):
 *   1. الشهيق (4 ثوانٍ): نفس عميق وبطيء من الأنف يملأ البطن بهدوء
 *   2. حبس النفس (4 ثوانٍ): الاحتفاظ بالهواء دون توتر
 *   3. الزفير (6 ثوانٍ): إخراج الهواء ببطء شديد كأنك تنفخ في شمعة
 *   4. التكرار من 3 إلى 5 دقائق حتى تهدأ ضربات القلب
 * الدورة = 14 ثانية → 3 دقائق ≈ 13 دورة، 5 دقائق ≈ 21 دورة.
 * دائرة متحركة تقود الإيقاع + عدّاد لكل طور + وقت إجمالي متبقٍّ،
 * ونص إرشادي تحت كل طور (املأ بطنك / دون توتر / نفخ الشمعة).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Wind, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Phase = "in" | "hold" | "out";
const PHASES: { key: Phase; seconds: number }[] = [
  { key: "in", seconds: 4 },
  { key: "hold", seconds: 4 },
  { key: "out", seconds: 6 },
];
const CYCLE_SECONDS = 14; /* 4 + 4 + 6 */
const DURATIONS = [
  { minutes: 3, cycles: 13 }, /* 182ث ≈ 3 دقائق */
  { minutes: 5, cycles: 21 }, /* 294ث ≈ 5 دقائق */
];

export function BreathingExerciseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [totalCycles, setTotalCycles] = useState(DURATIONS[0].cycles);
  const [remaining, setRemaining] = useState(PHASES[0].seconds);
  const [totalLeft, setTotalLeft] = useState(DURATIONS[0].cycles * CYCLE_SECONDS);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setPhaseIdx(0);
    setCycle(1);
    setRemaining(PHASES[0].seconds);
    setFinished(false);
  }, [stop]);

  const start = useCallback((cycles: number) => {
    reset();
    setTotalCycles(cycles);
    setTotalLeft(cycles * CYCLE_SECONDS);
    setRemaining(PHASES[0].seconds);
    setPhaseIdx(0);
    setRunning(true);
  }, [reset]);

  useEffect(() => {
    if (open) reset();
    else stop();
  }, [open, reset, stop]);

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        /* انتقال الطور */
        setPhaseIdx((pi) => {
          const next = pi + 1;
          if (next < PHASES.length) {
            setRemaining(PHASES[next].seconds);
            return next;
          }
          /* انتهت الدورة */
          setCycle((c) => {
            if (c + 1 > totalCycles) {
              setFinished(true);
              setRunning(false);
              return c;
            }
            setRemaining(PHASES[0].seconds);
            return c + 1;
          });
          return 0;
        });
        setTotalLeft((tl) => Math.max(0, tl - 1));
        return r;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, totalCycles]);

  const phase = PHASES[phaseIdx];
  const phaseLabel = phase.key === "in" ? t.breathing.phaseIn : phase.key === "hold" ? t.breathing.phaseHold : t.breathing.phaseOut;
  const phaseHint = phase.key === "in" ? t.breathing.inHint : phase.key === "hold" ? t.breathing.holdHint : t.breathing.outHint;
  const scale = phase.key === "in" ? 1 : phase.key === "hold" ? 1 : 0.55;
  const mm = String(Math.floor(totalLeft / 60)).padStart(1, "0");
  const ss = String(totalLeft % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start flex items-center gap-2">
            <Wind className="h-5 w-5 text-primary" />
            {t.breathing.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs font-semibold text-muted-foreground -mt-1 leading-relaxed">{t.breathing.subtitle}</p>

        {!running && !finished && (
          /* خطوات التطبيق الأربع — كما هي بالحرف مع ترجمة تفي بالمعنى */
          <div className="space-y-2">
            {[t.breathing.step1, t.breathing.step2, t.breathing.step3].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                <span className="text-[11px] font-black text-primary font-mono shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs font-semibold leading-relaxed flex-1">{s}</p>
              </div>
            ))}
            <p className="text-[11px] font-bold text-primary leading-relaxed px-1">{t.breathing.stepNote}</p>
          </div>
        )}

        <div className="py-2 flex flex-col items-center gap-5">
          {running ? (
            <>
              {/* الدائرة الموجّهة — تتوسع بالشهيق، ثبات بالحبس، تنكمش ببطء بالزفير */}
              <div className="relative h-52 w-52 flex items-center justify-center">
                <motion.div
                  key={`${phaseIdx}-${cycle}`}
                  animate={{ scale }}
                  transition={{ duration: phase.seconds, ease: phase.key === "out" ? "easeOut" : "easeInOut" }}
                  className="absolute inset-0 rounded-full gradient-primary opacity-25"
                />
                <motion.div
                  key={`${phaseIdx}-${cycle}-inner`}
                  animate={{ scale: scale + 0.15 }}
                  transition={{ duration: phase.seconds, ease: phase.key === "out" ? "easeOut" : "easeInOut" }}
                  className="absolute inset-6 rounded-full gradient-primary opacity-50"
                />
                <div className="relative z-10 text-center">
                  <div className="text-5xl font-black font-mono tabular-nums" dir="ltr">
                    {remaining}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground">{t.breathing.seconds}</div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="font-black text-lg">{phaseLabel}</p>
                {/* الإرشاد الفعلي لكل طور — املأ بطنك / دون توتر / نفخ الشمعة */}
                <p className="text-xs font-semibold text-muted-foreground leading-relaxed max-w-72">{phaseHint}</p>
                <p className="text-[11px] font-bold text-primary">
                  {t.breathing.cycleOf.replace("{n}", String(cycle)).replace("{total}", String(totalCycles))}
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="font-mono" dir="ltr">{mm}:{ss}</span>
                </p>
              </div>
            </>
          ) : finished ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-4xl">🌿</div>
              <p className="font-black text-lg">{t.breathing.done}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="gradient-primary text-white font-black rounded-xl" onClick={() => start(DURATIONS[0].cycles)}>
                  {t.breathing.dur3}
                </Button>
                <Button variant="outline" className="rounded-xl font-black" onClick={() => start(DURATIONS[1].cycles)}>
                  {t.breathing.dur5}
                </Button>
              </div>
            </div>
          ) : (
            /* اختيار المدة: 3 أو 5 دقائق — كما نصّ التمرين (3 إلى 5 دقائق) */
            <div className="w-full text-center space-y-4 py-2">
              <p className="text-xs font-semibold text-muted-foreground leading-relaxed">{t.breathing.hint}</p>
              <p className="text-xs font-black">{t.breathing.durTitle}</p>
              <div className="grid grid-cols-2 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.minutes}
                    onClick={() => start(d.cycles)}
                    className="rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/15 transition-all px-3 py-4 space-y-1"
                  >
                    <div className="text-2xl font-black text-primary font-mono" dir="ltr">{d.minutes}:00</div>
                    <div className="text-[11px] font-bold text-muted-foreground">{t.breathing.durNote.replace("{n}", String(d.cycles))}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {running && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={stop}>
              {t.breathing.stop}
            </Button>
          </div>
        )}
        <button
          onClick={() => onOpenChange(false)}
          className="w-full py-1.5 text-center text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
        >
          <X className="h-3 w-3" />
          {t.common.close}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** زر مختصر يُستعمل في الهيدر والصفحات */
export function BreathingTriggerButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={`gap-1.5 font-bold text-primary hover:text-primary ${className || ""}`}
        onClick={() => setOpen(true)}
        title={t.breathing.openBtn}
      >
        <Wind className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">{t.breathing.openBtn}</span>
      </Button>
      <BreathingExerciseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
