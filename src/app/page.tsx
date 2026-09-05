"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { playSound, initGlobalSounds } from "@/lib/sounds";
import { syncPushSubscription } from "@/lib/push-client";
import { AppHeader } from "@/components/shared/header";
import { AppFooter } from "@/components/shared/footer";
import { BackToTop } from "@/components/shared/back-to-top";
import { WelcomeQuote } from "@/components/shared/welcome-quote";
import { ViewSkeleton } from "@/components/shared/algeria-skeleton";
import { LandingView } from "@/components/views/landing";
import { RolesView } from "@/components/views/roles";
import { VictimStartView } from "@/components/views/victim-start";
import { VictimTopicsView } from "@/components/views/victim-topics";
import { VictimSlotsView } from "@/components/views/victim-slots";
import { VictimFindView } from "@/components/views/victim-find";
import { VictimSessionsView } from "@/components/views/victim-sessions";
import { SessionRoomView } from "@/components/session/session-room";
import { CounselorRegisterView } from "@/components/views/counselor-register";
import { CounselorLoginView } from "@/components/views/counselor-login";
import { CounselorAuthView } from "@/components/views/counselor-auth";
import { CounselorsDirectoryView } from "@/components/views/counselors-directory";
import { CounselorDashboardView } from "@/components/views/counselor-dashboard";
import { AdminLoginView, AdminPanelView } from "@/components/views/admin";
import { SettingsView } from "@/components/views/settings";
import { FeedbackView } from "@/components/views/feedback";
import { AboutView, FaqView, PrivacyView, TermsView, ContactView } from "@/components/views/info-pages";
import { GratitudeView } from "@/components/views/gratitude";
import { FoundersView } from "@/components/views/founders";
import { DuaView } from "@/components/views/dua";
import { AdminChatView } from "@/components/views/admin-chat";
import { DmDialog } from "@/components/shared/dm-dialog";

const VIEWS: Record<string, React.ComponentType> = {
  landing: LandingView,
  roles: RolesView,
  "victim-start": VictimStartView,
  "victim-topics": VictimTopicsView,
  "victim-slots": VictimSlotsView,
  "victim-find": VictimFindView,
  "victim-sessions": VictimSessionsView,
  "session-room": SessionRoomView,
  "counselor-auth": CounselorAuthView,
  "counselor-register": CounselorRegisterView,
  "counselor-login": CounselorLoginView,
  "counselor-dashboard": CounselorDashboardView,
  "admin-chat": AdminChatView,
  "counselors-directory": CounselorsDirectoryView,
  "admin-login": AdminLoginView,
  "admin-panel": AdminPanelView,
  settings: SettingsView,
  feedback: FeedbackView,
  about: AboutView,
  faq: FaqView,
  privacy: PrivacyView,
  terms: TermsView,
  contact: ContactView,
  gratitude: GratitudeView,
  founders: FoundersView,
  dua: DuaView,
};

const SKELETON_MS = 420;

export default function Home() {
  const view = useApp((s) => s.view);
  const fontScale = useApp((s) => s.fontScale);
  const [booting, setBooting] = useState(true);
  /* v2.8.0: مع استعادة الصفحة المحفوظة بعد F5 — غرفة الجلسة بلا جلسة نشطة تعود للرئيسية */
  useEffect(() => {
    const st = useApp.getState();
    if (st.view === "session-room" && !st.activeSessionId) {
      useApp.setState({ view: "landing" });
    }
  }, []);
  const CurrentView = VIEWS[view] ?? LandingView;
  const fullBleed = view === "session-room";

  /* حجم الخط العام (إمكانية الوصول) — كل مقاسات Tailwind rem تتّبع نسبة html */
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
  }, [fontScale]);

  /* نقرة عامة على كل الأزرار + هيكل تحميل بعلم الجزائر عند كل تنقّل أو تحميل */
  useEffect(() => {
    initGlobalSounds();
  }, []);

  /* 🔄 مزامنة صامتة لاشتراك الإشعارات عند كل ولوج: إن تغيّر مفتاح الخادم
     (تحديث/نشر جديد) يُجدّد اشتراك من فعّل الإشعارات سابقاً تلقائياً —
     بلا أي رسالة أو تدخل (جزء من الحل النهائي لإشعارات الهاتف) */
  useEffect(() => {
    const u = useApp.getState().user;
    if (u?.id && u.role !== "ADMIN") {
      void syncPushSubscription(u.id, u.role).catch(() => {});
    }
  }, []);

  /* v2.5.5: ربط عميق من الملف العام للأخصائي —
     /?book={userId}&lang=ar يفتح المنصة ويبدأ عملية حجز جلسة مع
     الأخصائي المعني مباشرة: موثّق → نافذة الحجز في دليل الأخصائيين،
     غير موثّق → مسار التسجيل كمتضرر ثم تُفتح نافذة الحجز تلقائياً.
     كما يُطبّق لغة الزائر (?lang=) المختارة من صفحة الملف العام. */
  const setLang = useI18n().setLang;
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const l = sp.get("lang");
      if (l === "ar" || l === "fr" || l === "en") setLang(l);
      const book = sp.get("book");
      if (book) {
        sessionStorage.setItem("rafiqi-pending-book", book.slice(0, 120));
        const u = useApp.getState().user;
        useApp.getState().setView(u?.role === "VICTIM" ? "victim-find" : "victim-start");
        sp.delete("book");
        sp.delete("lang");
        const qs = sp.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
      /* ─── v2.9.0: روابط الإشعارات (?session= / ?dm=) — الضغط على إشعار الهاتف
         عند إغلاق المنصة يفتح المنصة ثم الغرفة أو المحادثة مباشرة ─── */
      const notifSession = sp.get("session");
      const notifDm = sp.get("dm");
      /* v2.10.0: رابط إشعار محادثة الإدارة — يفتح الصفحة مباشرة للمختص */
      const notifAdminChat = sp.get("admin-chat");
      if (notifSession || notifDm || notifAdminChat) {
        if (notifSession) sessionStorage.setItem("rafiqi-open-session", notifSession.slice(0, 80));
        if (notifDm) sessionStorage.setItem("rafiqi-open-dm", notifDm.slice(0, 80));
        if (notifAdminChat) sessionStorage.setItem("rafiqi-open-admin-chat", "1");
        sp.delete("session");
        sp.delete("dm");
        sp.delete("admin-chat");
        const qs = sp.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
    } catch {
      /* تجاهل أي فشل — الربط العميق ميزة إضافية */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setBooting(true);
    const t = setTimeout(() => setBooting(false), SKELETON_MS);
    return () => clearTimeout(t);
  }, [view]);

  /* ─── v2.9.0: تنفيذ روابط الإشعارات بعد استقرار الجلسة والمستخدم ───
     ?session={id} يفتح غرفة الجلسة مباشرة، و?dm={peerId} يفتح المحادثة
     مع الطرف المرسل — مع جلب اسمه من الخادم. */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const sid = sessionStorage.getItem("rafiqi-open-session");
        const dmid = sessionStorage.getItem("rafiqi-open-dm");
        const st = useApp.getState();
        if (sid && st.user && st.user.role !== "ADMIN") {
          sessionStorage.removeItem("rafiqi-open-session");
          st.setActiveSession(sid);
          st.setView("session-room");
          return;
        }
        if (dmid && st.user) {
          sessionStorage.removeItem("rafiqi-open-dm");
          fetch(`/api/dm-peer?id=${encodeURIComponent(dmid)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              window.dispatchEvent(new CustomEvent("open-dm", { detail: { id: dmid, name: d?.name || "—" } }));
            })
            .catch(() => {
              window.dispatchEvent(new CustomEvent("open-dm", { detail: { id: dmid, name: "—" } }));
            });
        }
        /* v2.10.0: محادثة الإدارة — للمختص فقط */
        const adminChat = sessionStorage.getItem("rafiqi-open-admin-chat");
        if (adminChat && st.user && st.user.role === "COUNSELOR") {
          sessionStorage.removeItem("rafiqi-open-admin-chat");
          st.setView("admin-chat");
          return;
        }
        if (adminChat) sessionStorage.removeItem("rafiqi-open-admin-chat");
      } catch {
        /* تجاهل */
      }
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  /* نغمة التنقّل — صامتة قبل أول تفاعل (سياسة المتصفحات) */
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    playSound("navigate");
  }, [view]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {booting ? (
            <motion.div
              key={`skeleton-${view}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <ViewSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              <CurrentView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {!fullBleed && <AppFooter />}
      <BackToTop />
      {/* v2.8.0: محادثة ما قبل الجلسة — تُفتح من زر «تواصل» في أي صفحة */}
      <DmDialog />
      {/* نافذة «لحظة اطمئنان» — تظهر عند كل ولوج للموقع وتختفي تلقائياً بعد 7 ثوانٍ */}
      <WelcomeQuote />
    </div>
  );
}
