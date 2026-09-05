"use client";

import { motion } from "framer-motion";

/**
 * علم الجزائر الرسمي داخل شكل قلب — SVG نقي.
 * النصف الأيسر أخضر والأيمن أبيض، والهلال والنجمة الحمراء بالمواصفات الرسمية
 * (الهلال يفتح جهة الراية البيضاء والنجمة الخماسية داخل فتحته).
 * الهندسة محسوبة رياضياً: دائرتان متقاطعتان للهلال + نجمة بخمس رؤوس.
 * يُستخدم كهيكل تحميل (skeleton) عند كل تحميل أو تنقّل بين الصفحات.
 */
export function AlgeriaFlag({ className = "", size = 84 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.9}
      viewBox="0 0 100 90"
      className={className}
      role="img"
      aria-label="Algeria"
    >
      <defs>
        <clipPath id="heartClip">
          <path d="M50 88 C26 68 6 50 6 30 C6 16 17 6 30 6 C38 6 45.5 10.5 50 18 C54.5 10.5 62 6 70 6 C83 6 94 16 94 30 C94 50 74 68 50 88 Z" />
        </clipPath>
      </defs>

      {/* مستطيلا العلم داخل القلب */}
      <g clipPath="url(#heartClip)">
        <rect x="0" y="0" width="50" height="90" fill="#006233" />
        <rect x="50" y="0" width="50" height="90" fill="#ffffff" />
        {/* الهلال — يفتح جهة اليمين (البيضاء) كما في العلم الرسمي */}
        <path
          d="M59.38 24.29 A15 15 0 1 0 59.38 47.71 A12.5 12.5 0 1 1 59.38 24.29 Z"
          fill="#d21034"
        />
        {/* النجمة الخماسية داخل فتحة الهلال */}
        <path
          d="M61.5 30.8 L62.72 34.32 L66.45 34.39 L63.48 36.64 L64.56 40.21 L61.5 38.08 L58.44 40.21 L59.52 36.64 L56.55 34.39 L60.28 34.32 Z"
          fill="#d21034"
        />
      </g>

      {/* حدود خفيفة تُبرز القلب على الخلفيات الفاتحة والداكنة */}
      <path
        d="M50 88 C26 68 6 50 6 30 C6 16 17 6 30 6 C38 6 45.5 10.5 50 18 C54.5 10.5 62 6 70 6 C83 6 94 16 94 30 C94 50 74 68 50 88 Z"
        fill="none"
        stroke="#000000"
        strokeOpacity="0.1"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** هيكل تحميل الصفحة: علم الجزائر النابض + أسطر وهمية متدرجة */
export function ViewSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 gap-7">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="absolute inset-0 -m-8 rounded-full bg-primary/10 animate-ping opacity-30" />
        <AlgeriaFlag size={96} className="drop-shadow-lg animate-pulse" />
      </motion.div>
      <div className="w-full max-w-xs space-y-3" aria-hidden>
        <div className="h-3.5 rounded-full bg-muted animate-pulse" />
        <div className="h-3 rounded-full bg-muted animate-pulse w-4/5 mx-auto [animation-delay:120ms]" />
        <div className="h-3 rounded-full bg-muted animate-pulse w-3/5 mx-auto [animation-delay:240ms]" />
        <div className="grid grid-cols-3 gap-3 pt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
