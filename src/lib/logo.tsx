import { cn } from "@/lib/utils";

/**
 * شعار "رفيقي النفسي" — رمز طب النفس Ψ داخل هلال جزائري
 * مع نجمة صغيرة بلمسة خضراء جزائرية. SVG قابل للتحجيم لكل الأحجام.
 */
export function LogoMark({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Rafiqi logo"
    >
      <defs>
        <linearGradient id="rafiqiGrad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="0.55" stopColor="#0D9488" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="rafiqiGradSoft" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>

      {/* دائرة خارجية */}
      <circle cx="32" cy="32" r="30" fill="url(#rafiqiGrad)" />
      <circle cx="32" cy="32" r="30" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* الهلال الجزائري (قمر منزوع من قرص) */}
      <path
        d="M40.5 12.5a21.5 21.5 0 1 0 0 39 24.5 24.5 0 0 1 0-39Z"
        fill="#FFFFFF"
        fillOpacity="0.16"
      />

      {/* رمز علم النفس Ψ */}
      <g stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" fill="none">
        <path d="M32 17.5v27" />
        <path d="M20.5 25.5c0 8.5 4.5 13 11.5 13" />
        <path d="M43.5 25.5c0 8.5-4.5 13-11.5 13" />
        <circle cx="20.5" cy="21.5" r="3.6" fill="#FFFFFF" stroke="none" />
        <circle cx="43.5" cy="21.5" r="3.6" fill="#FFFFFF" stroke="none" />
      </g>

      {/* النجمة الجزائرية الخماسية */}
      <path
        d="M47.5 42.5l1.7 3.4 3.8.5-2.75 2.65.65 3.75-3.4-1.8-3.4 1.8.65-3.75-2.75-2.65 3.8-.5z"
        fill="url(#rafiqiGradSoft)"
        stroke="#FFFFFF"
        strokeWidth="0.8"
        strokeOpacity="0.7"
      />
    </svg>
  );
}

export function LogoFull({
  className,
  lang = "ar",
  compact = false,
}: {
  className?: string;
  lang?: string;
  compact?: boolean;
}) {
  const names: Record<string, { main: string; sub: string }> = {
    ar: { main: "رفيقي النفسي", sub: "منصة الدعم النفسي لضحايا الكوارث" },
    fr: { main: "Rafiqi Annafsi", sub: "Compagnon psychologique — Algérie" },
    en: { main: "Rafiqi Annafsi", sub: "Psychological Companion Platform" },
    tr: { main: "Rafiqi Annafsi", sub: "Psikolojik Destek Platformu" },
    ru: { main: "Rafiqi Annafsi", sub: "Платформа психологической поддержки" },
    zh: { main: "Rafiqi Annafsi", sub: "心理支持平台" },
  };
  const n = names[lang] ?? names.ar;
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <LogoMark size={compact ? 34 : 42} />
      {/* v2.9.0: النص لا يلتف أبداً على عدة أسطر في الهواتف — يُقصّ بسطر واحد،
          والوصف الفرعي يظهر على الشاشات المتوسطة فأعلى فقط */}
      <div className="flex flex-col leading-tight min-w-0">
        <span
          className={cn(
            "font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent whitespace-nowrap",
            lang === "ar" ? "text-base sm:text-lg" : "text-sm sm:text-base"
          )}
        >
          {n.main}
        </span>
        {!compact && (
          <span className="hidden md:block text-[10px] sm:text-[11px] text-muted-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[46vw] md:max-w-none">
            {n.sub}
          </span>
        )}
      </div>
    </div>
  );
}
