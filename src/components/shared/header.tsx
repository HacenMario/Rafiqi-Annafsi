"use client";

import { useRef } from "react";
import { useTheme } from "next-themes";
import { Languages, Moon, Sun, Menu, LogOut, UserRound, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useI18n, LANG_META } from "@/lib/i18n";
import { useApp, type ViewName } from "@/lib/store";
import { LogoFull } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { BreathingTriggerButton } from "@/components/shared/breathing-exercise";
import { triggerQuickHideIfEnabled } from "@/lib/quick-hide";
import { cn } from "@/lib/utils";
import type { AppLang } from "@/lib/constants";

export function AppHeader() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, view, setView, logout } = useApp();
  const [open, setOpen] = useState(false);
  /* v2.8.0: نافذة «هام جدا - اقرأني» — إرشادات التثبيت وتفعيل الإشعارات */
  const [importantOpen, setImportantOpen] = useState(false);

  /* الإخفاء السريع (v2.5.3): 3 ضغطات سريعة على الشعار = اختباء فوري خلف حاسبة.
     الضغطة المنفردة تبقى تنقلاً عادياً للرئيسية — لا تغيير يُلاحظ */
  const tapTimesRef = useRef<number[]>([]);
  const onLogoTap = () => {
    setView("landing");
    const now = Date.now();
    const times = [...tapTimesRef.current, now].filter((t) => now - t < 800);
    tapTimesRef.current = times;
    if (times.length >= 3) {
      tapTimesRef.current = [];
      triggerQuickHideIfEnabled();
    }
  };

  const role = user?.role;
  /* wide: روابط ثانوية تظهر فقط على الشاشات العريضة (≥1536px) — بالفرنسية والإنجليزية
     تستهلك مساحة كبيرة وتضغط القائمة، وهي متوفرة في قائمة الهاتف والفوتر دائماً */
  const navItems: { label: string; view: ViewName; show: boolean; wide?: boolean }[] = [
    { label: t.nav.home, view: "landing", show: true },
    { label: t.nav.findHelp, view: "roles", show: !role || role === "VICTIM" },
    { label: t.nav.counselors, view: "counselors-directory", show: true, wide: true },
    { label: t.nav.sessions, view: "victim-sessions", show: role === "VICTIM" },
    { label: t.nav.dashboard, view: "counselor-dashboard", show: role === "COUNSELOR" },
    { label: t.nav.adminChat, view: "admin-chat", show: role === "COUNSELOR" },
    { label: t.nav.admin, view: "admin-panel", show: role === "ADMIN" },
    { label: t.nav.settings, view: "settings", show: true },
    { label: t.nav.thanks, view: "gratitude", show: true, wide: true },
    { label: t.nav.about, view: "about", show: true, wide: true },
    { label: t.nav.faq, view: "faq", show: true, wide: true },
    { label: t.nav.feedback, view: "feedback", show: true, wide: true },
  ];
  /* روابط إضافية في قائمة الهاتف — نستبعد ما ظهر فعلاً في القائمة الرئيسية
     (الأخصائيون/الشكر مثلاً) حتى لا تتكرر الصفحة نفسها مرتين في sidebar */
  const shownViews = new Set(navItems.filter((n) => n.show).map((n) => n.view));
  const secondaryItems: { label: string; view: ViewName }[] = (
    [
      { label: t.nav.counselors, view: "counselors-directory" as ViewName },
      { label: t.nav.thanks, view: "gratitude" as ViewName },
      { label: t.nav.privacy, view: "privacy" as ViewName },
      { label: t.nav.terms, view: "terms" as ViewName },
      { label: t.nav.contact, view: "contact" as ViewName },
      /* v2.8.0: صفحة المؤسسين */
      { label: t.founders.title, view: "founders" as ViewName },
      /* v2.9.0: صفحة الدعاء */
      { label: t.dua.title, view: "dua" as ViewName },
      /* دخول الإدارة — في أسفل القائمة بعيداً عن مسارات المستخدمين */
      { label: t.nav.adminLogin, view: "admin-login" as ViewName },
    ]
  ).filter((n) => !shownViews.has(n.view));

  const cycleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const doLogout = () => {
    setOpen(false);
    logout();
    setView("landing");
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <button
          onClick={onLogoTap}
          className="flex items-center rounded-xl focus-visible:ring-2 ring-ring outline-none"
          aria-label={t.common.appName}
        >
          <LogoFull lang={lang} compact={false} />
        </button>

        {/* Desktop nav — الروابط الثانوية فقط على الشاشات العريضة (≥1536px)
            حتى لا تضغط النصوص الفرنسية/الإنجليزية الطويلة، وهي متوفرة دائماً
            في قائمة الهاتف والفوتر */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 min-w-0" aria-label="main">
          {navItems
            .filter((n) => n.show)
            .map((n) => (
              <Button
                key={n.view}
                variant={view === n.view ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "text-sm font-semibold px-2.5 xl:px-3 whitespace-nowrap",
                  n.wide && "hidden 2xl:inline-flex"
                )}
                onClick={() => setView(n.view)}
              >
                {n.label}
              </Button>
            ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* v2.9.0: زر تمرين تهدئة النفس — متاح في كل الصفحات */}
          <BreathingTriggerButton className="hidden sm:inline-flex" />

          {/* v2.8.0: زر «هام جدا - اقرأني» بلون يلفت الانتباه — إرشادات التثبيت والإشعارات */}
          <Button
            size="sm"
            className="gradient-primary text-white font-black rounded-lg px-2 sm:px-3 h-9 animate-pulse shadow-md shadow-amber-500/20 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            onClick={() => setImportantOpen(true)}
            title={t.nav.important}
          >
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline text-[11px] whitespace-nowrap">{t.nav.important}</span>
          </Button>

          {/* Notifications bell */}
          <NotificationsBell />

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t.settings.languageLabel}>
                <Languages className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(LANG_META) as AppLang[]).map((l) => (
                <DropdownMenuItem
                  key={l}
                  onClick={() => setLang(l)}
                  className={lang === l ? "bg-accent" : ""}
                >
                  <span>{LANG_META[l].flag}</span>
                  <span className="font-semibold">{LANG_META[l].label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme */}
          <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label={t.settings.themeLabel}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Logout (desktop) */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex text-destructive"
              onClick={doLogout}
              aria-label={t.nav.logout}
              title={t.nav.logout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t.nav.menu}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={lang === "ar" ? "right" : "left"} className="w-72 flex flex-col">
              <SheetHeader className="p-4">
                <SheetTitle>
                  <LogoFull lang={lang} compact />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto" aria-label="mobile">
                {navItems
                  .filter((n) => n.show)
                  .map((n) => (
                    <Button
                      key={n.view}
                      variant={view === n.view ? "secondary" : "ghost"}
                      className="justify-start font-semibold"
                      onClick={() => {
                        setView(n.view);
                        setOpen(false);
                      }}
                    >
                      {n.label}
                    </Button>
                  ))}

                <div className="h-px bg-border my-2" />

                {/* الصفحات الثانوية — كل الصفحات المناسبة في قائمة الهاتف */}
                {secondaryItems.map((n) => (
                  <Button
                    key={n.view}
                    variant={view === n.view ? "secondary" : "ghost"}
                    className="justify-start font-semibold text-muted-foreground"
                    onClick={() => {
                      setView(n.view);
                      setOpen(false);
                    }}
                  >
                    {n.label}
                  </Button>
                ))}
              </nav>

              {/* هوية المستخدم + تسجيل الخروج */}
              {user && (
                <div className="p-3 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    <span className="truncate font-semibold">
                      {user.role === "COUNSELOR" ? user.fullName || "—" : user.role === "VICTIM" ? user.pseudonym : t.roles.adminTitle}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start font-bold text-destructive border-destructive/40"
                    onClick={doLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t.nav.logout}
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* v2.8.0: نافذة الإرشادات — تُترجم حسب لغة المستخدم */}
      <Dialog open={importantOpen} onOpenChange={setImportantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2 text-base">
              <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0" />
              {t.important.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs font-bold text-muted-foreground -mt-1">{t.important.subtitle}</p>
          <div className="space-y-2.5">
            {[t.important.step1, t.important.step2, t.important.step3, t.important.step4].map((line, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5">
                <span className="text-[11px] font-black text-primary font-mono shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs font-semibold leading-relaxed flex-1">{line}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-3.5 py-3 space-y-1.5">
            <p className="text-xs font-black text-primary flex items-center gap-1.5">
              <TriangleAlert className="h-3.5 w-3.5" />
              {t.important.notifTitle}
            </p>
            {[t.important.notifStep1, t.important.notifStep2, t.important.notifStep3].map((line, i) => (
              <p key={i} className="text-[11px] font-semibold text-muted-foreground leading-relaxed">
                • {line}
              </p>
            ))}
          </div>
          <div className="space-y-2">
            <Button
              className="w-full gradient-primary text-white font-black rounded-xl h-11"
              onClick={() => {
                setImportantOpen(false);
                setView("settings");
              }}
            >
              {t.important.openSettings}
            </Button>
            <Button variant="outline" className="w-full rounded-xl font-bold" onClick={() => setImportantOpen(false)}>
              {t.common.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
