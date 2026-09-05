"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionMode, TopicKey, AppLang } from "@/lib/constants";

export type ViewName =
  | "landing"
  | "roles"
  | "victim-start"
  | "victim-topics"
  | "victim-slots"
  | "victim-find"
  | "victim-sessions"
  | "session-room"
  | "counselor-auth"
  | "counselor-register"
  | "counselor-login"
  | "counselor-dashboard"
  | "admin-chat"
  | "counselors-directory"
  | "admin-login"
  | "admin-panel"
  | "settings"
  | "feedback"
  | "about"
  | "faq"
  | "privacy"
  | "terms"
  | "contact"
  | "gratitude"
  | "founders"
  | "dua";

export interface AuthUser {
  id: string;
  role: "VICTIM" | "COUNSELOR" | "ADMIN";
  pseudonym?: string;
  fullName?: string;
  email?: string;
  language?: AppLang;
  wilaya?: string;
  ageGroup?: string;
  gender?: "male" | "female" | null;
  /* v2.7.0: هاتف المتضرر (بياناته الخاصة) — يظهر للأخصائي المختار في جلسة فقط */
  phone?: string | null;
  /* v2.9.0: حالة توثيق التضرر من الحرائق — PENDING يمنع الحجز إلى مراجعة الأدمين */
  fireStatus?: "PENDING" | "REJECTED" | "VERIFIED";
  verified?: boolean;
  photo?: string;
}

interface VictimDraft {
  topic?: TopicKey;
  wilaya?: string;
  ageGroup?: string;
  prefLang?: AppLang;
  /* v2.6.0 — الخيار الأول: المواعيد التي اختارها المتضرر قبل ظهور القائمة
     [{ date: "YYYY-MM-DD", slot: "HH:MM" }] — فارغة = تخطّى الخطوة
     أو جاء من مسار لا يفرض اختيار المواعيد */
  preferredSlots?: { date: string; slot: string }[];
}

interface AppState {
  view: ViewName;
  history: ViewName[];
  user: AuthUser | null;
  victimDraft: VictimDraft;
  activeSessionId: string | null;
  /* حجم خط عام قابل للتكبير/التصغير (نسبة %) — لإمكانية الوصول لكل الفئات */
  fontScale: number;
  setFontScale: (n: number) => void;
  setView: (v: ViewName) => void;
  goBack: () => void;
  setUser: (u: AuthUser | null) => void;
  setDraft: (d: Partial<VictimDraft>) => void;
  setActiveSession: (id: string | null) => void;
  logout: () => void;
  reset: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      view: "landing",
      history: [],
      user: null,
      victimDraft: {},
      activeSessionId: null,
      fontScale: 100,
      setFontScale: (n) => set({ fontScale: Math.min(140, Math.max(85, n)) }),
      setView: (v) => {
        const cur = get().view;
        if (cur === v) return;
        set({ view: v, history: [...get().history, cur].slice(-20) });
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      },
      goBack: () => {
        const h = [...get().history];
        const prev = h.pop() ?? "landing";
        set({ view: prev, history: h });
      },
      setUser: (u) => set({ user: u }),
      setDraft: (d) => set({ victimDraft: { ...get().victimDraft, ...d } }),
      setActiveSession: (id) => set({ activeSessionId: id }),
      /* تسجيل الخروج لكل الأدوار: ينظّف الجلسة النشطة ويُبقي مسودة المتضرر */
      logout: () => set({ user: null, activeSessionId: null, view: "landing" }),
      reset: () => set({ view: "landing", history: [], user: null, victimDraft: {}, activeSessionId: null }),
    }),
    {
      name: "rafiqi-state",
      /* v2.8.0: الصفحة الحالية تُحفَظ — تحديث الصفحة (F5) يبقي المستخدم مكانه
         بدل إعادته دائماً للصفحة الرئيسية */
      partialize: (s) => ({ user: s.user, victimDraft: s.victimDraft, fontScale: s.fontScale, view: s.view }) as unknown as AppState,
    }
  )
);
