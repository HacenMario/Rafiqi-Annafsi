"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Users,
  CalendarCheck2,
  HeartPulse,
  BadgeCheck,
  XCircle,
  BarChart3,
  UserPlus,
  Trash2,
  KeyRound,
  Search,
  MessageSquareHeart,
  CheckCircle2,
  Quote as QuoteIcon,
  Plus,
  Pencil,
  Sparkles,
  Heart,
  Download,
  FileSpreadsheet,
  Award,
  Inbox,
  Power,
  AlarmClock,
  Trophy,
  RefreshCw,
  Ban,
  Megaphone,
  UsersRound,
  HeartHandshake,
  PlusCircle,
  Eye,
} from "lucide-react";
import { LayoutDashboard, Flame } from "lucide-react";
import { WILAYA_LIST, WILAYA_LABELS, AGE_LABELS, SPECIALTIES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { formatWhatsapp } from "@/lib/whatsapp";
import { formatDateTime } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTab, VictimVerifyTab } from "@/components/views/admin-dashboard";
import { AdminInboxTab } from "@/components/views/admin-inbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackButton } from "@/components/shared/back-button";
import { RoyalCrown } from "@/components/shared/crown-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PendingProfile {
  id: string;
  userId: string;
  fullName: string;
  email?: string | null;
  whatsapp?: string | null;
  specialties: string[];
  languages: string[];
  bio?: string;
  yearsExperience: number;
  diplomaImage?: string | null;
  verificationStatus: string;
}

interface AdminUserRow {
  id: string;
  role: "VICTIM" | "COUNSELOR" | "ADMIN";
  pseudonym: string | null;
  email: string | null;
  wilaya: string | null;
  createdAt: string;
  fullName: string | null;
  whatsapp: string | null;
  verificationStatus: string | null;
  /* v2.6.0: حالة التعليق + عدّاد التأخر في قبول الطلبات */
  suspended?: boolean;
  lateCount?: number;
}

/* v2.6.0: طلب حجز معلّق (للأدمين) */
interface PendingRequestRow {
  id: string;
  victimAlias: string | null;
  createdAt: string | null;
  scheduledAt: string | null;
  topic: string | null;
  mode: string | null;
  hoursPending: number;
}

/* v2.6.0: طلب تجاوز 36 ساعة بلا قبول (لافتة الأدمين) */
interface OverdueRow {
  id: string;
  counselorId: string;
  counselorName: string | null;
  victimAlias: string | null;
  createdAt: string;
  scheduledAt: string | null;
  topic: string | null;
  mode: string | null;
  hoursPending: number;
}

interface FeedbackRow {
  id: string;
  type: string;
  subject: string;
  message: string;
  contact: string | null;
  handled: boolean;
  createdAt: string;
}

interface CrisisRow {
  id: string;
  sessionId?: string | null;
  source: string;
  phrase: string;
  action: string;
  /* v2.5.4: من كتب العبارة + طرفا الجلسة */
  saidBy?: string | null;
  victimAlias?: string | null;
  counselorName?: string | null;
  createdAt: string;
}

/* v2.8.0: طلب ملغى (تبويب الإدارة) */
interface CancelledRow {
  id: string;
  victimAlias: string | null;
  counselorName: string | null;
  topic: string | null;
  mode: string | null;
  scheduledAt: string | null;
  createdAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
}

/* v2.8.0: محتوى صفحة المؤسسين */
interface FoundersContent {
  textAr: string;
  textFr: string;
  textEn: string;
  developerName: string;
  developerRole: string;
  members: { name: string; role: string }[];
}

interface QuoteRow {
  id: string;
  textAr: string;
  textFr: string;
  textEn: string;
  author: string | null;
  category: string;
  active: boolean;
}

export function AdminLoginView() {
  const { t } = useI18n();
  const { setUser, setView } = useApp();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", passcode }),
      });
      const data = await res.json();
      if (data.ok) {
        setUser({ id: data.user.id, role: "ADMIN" });
        setView("admin-panel");
      } else {
        setError(t.admin.loginError);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14 md:py-20">
      <BackButton />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/70 shadow-lg">
          <CardContent className="p-7 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-13 h-13 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center p-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-black">{t.admin.loginTitle}</h1>
              <p className="text-xs text-muted-foreground">{t.admin.loginDesc}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">{t.admin.passcodeLabel}</Label>
              <Input
                type="password"
                dir="ltr"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="rounded-xl bg-card font-mono"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            {error && <div className="rounded-xl bg-destructive/10 text-destructive text-sm font-bold px-4 py-3">{error}</div>}
            <Button className="w-full gradient-primary text-white font-black rounded-xl h-12" disabled={busy} onClick={submit}>
              {busy ? t.common.loading : t.admin.loginSubmit}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ═══════════ لوحة الإشراف — صلاحيات كاملة ═══════════ */

export function AdminPanelView() {
  const { t, lang } = useI18n();
  const { user, setView } = useApp();
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [crisis, setCrisis] = useState<CrisisRow[]>([]);
  const [stats, setStats] = useState({ users: 0, sessions: 0, verifiedCounselors: 0, crises: 0, completed: 0 });
  /* v2.9.0: عدد طلبات توثيق المتضررين بانتظار المراجعة — شارة على تبويب لوحة القيادة */
  const [firePendingCount, setFirePendingCount] = useState(0);

  /* فلاتر الحسابات */
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);

  /* إنشاء حساب */
  const [showCreate, setShowCreate] = useState(false);
  const [createRole, setCreateRole] = useState<"VICTIM" | "COUNSELOR">("VICTIM");
  const [cPseudonym, setCPseudonym] = useState("");
  const [cFullName, setCFullName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cWhatsapp, setCWhatsapp] = useState("");
  /* v2.8.0: كل حقول التسجيل العادي في نافذة إنشاء الحساب */
  const [cWilaya, setCWilaya] = useState("");
  const [cAgeGroup, setCAgeGroup] = useState("");
  const [cGender, setCGender] = useState<"" | "male" | "female">("");
  const [cPhone, setCPhone] = useState("");
  const [cSpecialties, setCSpecialties] = useState<string[]>(["trauma"]);
  const [cLanguages, setCLanguages] = useState<string[]>(["ar"]);
  const [cBio, setCBio] = useState("");
  const [cYearsExp, setCYearsExp] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cVerified, setCVerified] = useState(true);
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState("");
  const [cErr, setCErr] = useState("");

  /* كلمة مرور + حذف */
  const [pwTarget, setPwTarget] = useState<AdminUserRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [zoomImg, setZoomImg] = useState<string | null>(null);

  /* ─── v2.6.0: الطلبات المتأخرة + نافذة طلبات الأخصائي + التفعيل/التعطيل ─── */
  const [overdue, setOverdue] = useState<OverdueRow[]>([]);
  const [reqTarget, setReqTarget] = useState<AdminUserRow | null>(null);
  const [reqList, setReqList] = useState<PendingRequestRow[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);

  /* ─── عبارات الاطمئنان: قائمة + إضافة + تعديل + حذف ─── */
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [qEditId, setQEditId] = useState<string | null>(null); // null = إضافة
  const [qTextAr, setQTextAr] = useState("");
  const [qTextFr, setQTextFr] = useState("");
  const [qTextEn, setQTextEn] = useState("");
  const [qAuthor, setQAuthor] = useState("");
  const [qCategory, setQCategory] = useState("wisdom");
  const [qBusy, setQBusy] = useState(false);
  const [qErr, setQErr] = useState("");
  const [qDeleteTarget, setQDeleteTarget] = useState<QuoteRow | null>(null);

  /* ─── صفحة الشكر والعرفان: محرر النص الثلاثي + رمز الخلفية ─── */
  const [grat, setGrat] = useState<{ textAr: string; textFr: string; textEn: string; symbol: string; active: boolean } | null>(null);
  const [gratBusy, setGratBusy] = useState(false);
  const [gratMsg, setGratMsg] = useState("");
  const [gratErr, setGratErr] = useState("");

  /* ─── تصدير Excel/CSV: المستخدمون، الجلسات، بلاغات الأزمة، الاقتراحات ─── */
  const [exportBusy, setExportBusy] = useState<string | null>(null);

  /* ─── v2.7.0: فائز التحدي — يظهر دائماً في لوحة الإدارة ─── */
  const [challengeWinner, setChallengeWinner] = useState<{ userId: string; name: string; profileId: string | null; wonAt: string | null } | null>(null);

  /* ─── v2.8.0: الطلبات الملغاة + الإشعار الجماعي + المؤسسون + تحديث اللوحة ─── */
  const [cancelled, setCancelled] = useState<CancelledRow[]>([]);
  const [cancelledDetails, setCancelledDetails] = useState<CancelledRow | null>(null);
  const [delReqTarget, setDelReqTarget] = useState<PendingRequestRow | null>(null);
  const [delReqBusy, setDelReqBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [bulkTarget, setBulkTarget] = useState<"ALL_VICTIMS" | "ALL_COUNSELORS" | "ALL" | "USER">("ALL_VICTIMS");
  const [bulkUserId, setBulkUserId] = useState("");
  const [bulkAr, setBulkAr] = useState("");
  const [bulkFr, setBulkFr] = useState("");
  const [bulkEn, setBulkEn] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkErr, setBulkErr] = useState("");

  const [founders, setFounders] = useState<FoundersContent | null>(null);
  const [foundersBusy, setFoundersBusy] = useState(false);
  const [foundersMsg, setFoundersMsg] = useState("");
  const [foundersErr, setFoundersErr] = useState("");

  const load = useCallback(async () => {
    const [p, f, c, s, q] = await Promise.all([
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pending-counselors" }),
      }).then((r) => r.json()),
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feedback-list" }),
      }).then((r) => r.json()),
      fetch("/api/crisis").then((r) => r.json()),
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stats" }),
      }).then((r) => r.json()),
      fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list-all" }) })
        .then((r) => r.json())
        .catch(() => ({ quotes: [] })),
    ]);
    setPending(p.pending || []);
    setFeedbacks(f.feedbacks || []);
    setCrisis(c.logs || []);
    if (s.stats) setStats(s.stats);
    setQuotes(q.quotes || []);
    /* v2.6.0: مسح الطلبات المتأخرة +36 ساعة — يوسمها، يزيد عدّاد الأخصائي،
       يُعلّق الحساب عند 3 تأخرات، ويُبلغ الأدمين — ثم يعيد القائمة للافتة */
    try {
      const ov = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "overdue-requests" }),
      }).then((r) => r.json());
      setOverdue(ov.overdue || []);
    } catch {
      /* لا نقف في حالة الفشل — اللافتة فقط تفشل */
    }
    /* محتوى صفحة الشكر */
    try {
      const g = await fetch("/api/gratitude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get" }) }).then((r) => r.json());
      if (g.content) {
        setGrat({ textAr: g.content.textAr, textFr: g.content.textFr, textEn: g.content.textEn, symbol: g.content.symbol, active: !!g.content.active });
      }
    } catch {}
    /* v2.7.0: فائز التحدي */
    try {
      const ch = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "challenge-status" }),
      }).then((r) => r.json());
      setChallengeWinner(ch.winner || null);
    } catch {
      /* التحدي اختياري في اللوحة */
    }
    /* v2.9.0: عدد طلبات توثيق المتضررين */
    try {
      const vv = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "victim-verifications" }),
      }).then((r) => r.json());
      setFirePendingCount((vv.victims || []).length);
    } catch {
      /* اختياري */
    }
    /* v2.8.0: الطلبات الملغاة + محتوى المؤسسين */
    try {
      const cd = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelled-requests" }),
      }).then((r) => r.json());
      setCancelled(cd.cancelled || []);
    } catch {
      /* التبويب اختياري */
    }
    try {
      const fd = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "founders-get" }),
      }).then((r) => r.json());
      if (fd.content) setFounders(fd.content as FoundersContent);
    } catch {
      /* اختياري */
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-users", role: roleFilter, q: query }),
      });
      const data = await res.json();
      setUsers(data.users || []);
    } finally {
      setUsersLoading(false);
    }
  }, [roleFilter, query]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(loadUsers, 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const act = async (profileId: string, action: "verify" | "reject" | "unverify") => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, profileId }),
    });
    load();
  };

  /* ─── حفظ صفحة الشكر والعرفان ─── */
  const saveGratitude = async () => {
    if (!grat) return;
    setGratErr("");
    setGratMsg("");
    if (!grat.textAr.trim() || !grat.textFr.trim() || !grat.textEn.trim()) {
      setGratErr(t.gratitude.missingLangs);
      return;
    }
    setGratBusy(true);
    try {
      const res = await fetch("/api/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...grat }),
      });
      const data = await res.json();
      if (data.ok) {
        setGratMsg(t.gratitude.saved);
        playSound("success");
      } else if (data.error === "MISSING_LANGUAGES") setGratErr(t.gratitude.missingLangs);
      else setGratErr(t.common.error);
    } finally {
      setGratBusy(false);
    }
  };

  /* ─── تصدير Excel (CSV بترميز UTF-8 مع BOM يُفتح مباشرة في Excel) ─── */
  const csvEscape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const downloadCsv = (name: string, headers: string[], rows: unknown[][]) => {
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const dayStamp = () => new Date().toISOString().slice(0, 10);

  const doExport = async (kind: "users" | "sessions" | "crisis" | "feedback") => {
    setExportBusy(kind);
    try {
      if (kind === "users") {
        const d = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list-users", role: "ALL", q: "" }) }).then((r) => r.json());
        downloadCsv(
          `rafiqi-users-${dayStamp()}.csv`,
          ["id", "role", "pseudonym", "fullName", "email", "wilaya", "verificationStatus", "createdAt"],
          (d.users || []).map((u: AdminUserRow) => [u.id, u.role, u.pseudonym, u.fullName, u.email, u.wilaya, u.verificationStatus, u.createdAt])
        );
      } else if (kind === "sessions") {
        const d = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list-sessions" }) }).then((r) => r.json());
        downloadCsv(
          `rafiqi-sessions-${dayStamp()}.csv`,
          ["id", "topic", "mode", "status", "victim", "counselor", "moodBefore", "moodAfter", "crisisFlag", "scheduledAt"],
          (d.sessions || []).map((s: Record<string, unknown>) => [s.id, s.topic, s.mode, s.status, s.victim, s.counselor, s.moodBefore, s.moodAfter, s.crisisFlag, s.scheduledAt])
        );
      } else if (kind === "crisis") {
        const d = await fetch("/api/crisis").then((r) => r.json());
        downloadCsv(
          `rafiqi-crisis-${dayStamp()}.csv`,
          ["id", "phrase", "source", "action", "saidBy", "victim", "counselor", "sessionId", "createdAt"],
          (d.logs || []).map((c: CrisisRow) => [c.id, c.phrase, c.source, c.action, c.saidBy ?? "", c.victimAlias ?? "", c.counselorName ?? "", c.sessionId ?? "", c.createdAt])
        );
      } else {
        const d = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "feedback-list" }) }).then((r) => r.json());
        downloadCsv(
          `rafiqi-feedback-${dayStamp()}.csv`,
          ["id", "type", "subject", "message", "contact", "handled", "createdAt"],
          (d.feedbacks || []).map((f: FeedbackRow) => [f.id, f.type, f.subject, f.message, f.contact, f.handled, f.createdAt])
        );
      }
      playSound("success");
    } catch {
      /* التعذر النادر — بلا إجراء إضافي */
    } finally {
      setExportBusy(null);
    }
  };

  const createAccount = async () => {
    setCErr("");
    setCMsg("");
    if (!cPassword || cPassword.length < 8) {
      setCErr(t.victim.weakPassword);
      return;
    }
    if (createRole === "VICTIM" && cPseudonym.trim().length < 3) {
      setCErr(t.victim.pseudonymRequired);
      return;
    }
    if (createRole === "COUNSELOR" && (!cFullName.trim() || !cEmail.trim())) {
      setCErr(t.common.requiredField);
      return;
    }
    setCBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-account",
          role: createRole,
          pseudonym: cPseudonym.trim(),
          fullName: cFullName.trim(),
          email: cEmail.trim(),
          whatsapp: cWhatsapp.trim(),
          wilaya: cWilaya || undefined,
          ageGroup: cAgeGroup || undefined,
          gender: cGender || undefined,
          phone: cPhone.trim() || undefined,
          specialties: cSpecialties,
          languages: cLanguages,
          bio: cBio.trim() || undefined,
          yearsExperience: cYearsExp ? Number(cYearsExp) : 0,
          password: cPassword,
          verified: cVerified,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCMsg(t.admin.createOk);
        playSound("success");
        setCPseudonym("");
        setCFullName("");
        setCEmail("");
        setCWhatsapp("");
        setCWilaya("");
        setCAgeGroup("");
        setCGender("");
        setCPhone("");
        setCSpecialties(["trauma"]);
        setCLanguages(["ar"]);
        setCBio("");
        setCYearsExp("");
        setCPassword("");
        loadUsers();
      } else if (data.error === "PSEUDONYM_TAKEN") setCErr(t.victim.pseudonymTaken);
      else if (data.error === "PSEUDONYM_REQUIRED") setCErr(t.victim.pseudonymRequired);
      else if (data.error === "EMAIL_EXISTS") setCErr(t.counselor.email + " — exists");
      else if (data.error === "INVALID_WHATSAPP") setCErr(t.counselor.whatsappInvalid);
      else if (data.error === "WEAK_PASSWORD") setCErr(t.victim.weakPassword);
      else setCErr(t.common.error);
    } finally {
      setCBusy(false);
    }
  };

  const setPw = async () => {
    if (!pwTarget) return;
    setPwMsg("");
    if (!pwValue || pwValue.length < 8) {
      setPwMsg(t.victim.weakPassword);
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-password", userId: pwTarget.id, newPassword: pwValue }),
      });
      const data = await res.json();
      if (data.ok) {
        setPwMsg(t.admin.setPwOk);
        playSound("success");
        setPwValue("");
        setTimeout(() => {
          setPwTarget(null);
          setPwMsg("");
        }, 1200);
      } else {
        setPwMsg(data.error === "WEAK_PASSWORD" ? t.victim.weakPassword : t.common.error);
      }
    } finally {
      setPwBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-user", userId: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.ok) {
        playSound("success");
        loadUsers();
        load();
      }
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  };

  const deleteFeedback = async (id: string) => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback-delete", feedbackId: id }),
    });
    load();
  };

  /* ─── v2.6.0: فتح نافذة الطلبات المعلّقة لأخصائي ─── */
  const openRequests = async (u: AdminUserRow) => {
    setReqTarget(u);
    setReqLoading(true);
    setReqList([]);
    try {
      const d = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "counselor-requests", counselorUserId: u.id }),
      }).then((r) => r.json());
      setReqList(d.requests || []);
    } finally {
      setReqLoading(false);
    }
  };

  /* ─── v2.6.0: تفعيل / تعطيل أي حساب (أخصائي أو متضرر) ─── */
  const toggleSuspend = async (u: AdminUserRow) => {
    const next = !u.suspended;
    setToggleBusy(u.id);
    try {
      const d = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-user", userId: u.id, suspended: next }),
      }).then((r) => r.json());
      if (d.ok) {
        playSound("success");
        loadUsers();
      }
    } finally {
      setToggleBusy(null);
    }
  };

  /* ─── v2.8.0: تحديث لوحة الإشراف دون تحديث الموقع كاملاً ─── */
  const refreshPanel = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), loadUsers()]);
    } finally {
      setRefreshing(false);
    }
  };

  /* ─── v2.8.0: حذف طلب معلّق مباشرة من المنصة ─── */
  const deletePendingRequest = async () => {
    if (!delReqTarget) return;
    setDelReqBusy(true);
    try {
      const d = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-session", sessionId: delReqTarget.id }),
      }).then((r) => r.json());
      if (d.ok) {
        playSound("success");
        setReqList((cur) => cur.filter((r) => r.id !== delReqTarget.id));
        load();
      }
    } finally {
      setDelReqBusy(false);
      setDelReqTarget(null);
    }
  };

  /* ─── v2.8.0: إرسال الإشعار الجماعي ─── */
  const sendBulk = async () => {
    setBulkErr("");
    setBulkMsg("");
    if (!bulkAr.trim()) {
      setBulkErr(t.admin.bulkTextAr);
      return;
    }
    if (bulkTarget === "USER" && !bulkUserId.trim()) {
      setBulkErr(t.admin.bulkUserLabel);
      return;
    }
    setBulkBusy(true);
    try {
      const d = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-notify",
          target: bulkTarget,
          userId: bulkUserId.trim() || undefined,
          textAr: bulkAr.trim(),
          textFr: bulkFr.trim() || undefined,
          textEn: bulkEn.trim() || undefined,
        }),
      }).then((r) => r.json());
      if (d.ok) {
        setBulkMsg(t.admin.bulkSent.replace("{n}", String(d.count ?? 0)));
        playSound("success");
        setBulkAr("");
        setBulkFr("");
        setBulkEn("");
        setBulkUserId("");
      } else {
        setBulkErr(t.common.error);
      }
    } finally {
      setBulkBusy(false);
    }
  };

  /* ─── v2.8.0: حفظ صفحة المؤسسين ─── */
  const saveFounders = async () => {
    if (!founders) return;
    setFoundersErr("");
    setFoundersMsg("");
    if (!founders.textAr.trim() || !founders.textFr.trim() || !founders.textEn.trim()) {
      setFoundersErr(t.gratitude.missingLangs);
      return;
    }
    setFoundersBusy(true);
    try {
      const d = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "founders-save", ...founders }),
      }).then((r) => r.json());
      if (d.ok) {
        setFoundersMsg(t.admin.foundersSaved);
        playSound("success");
      } else if (d.error === "MISSING_LANGUAGES") setFoundersErr(t.gratitude.missingLangs);
      else setFoundersErr(t.common.error);
    } finally {
      setFoundersBusy(false);
    }
  };

  /* ─── عبارات الاطمئنان: حفظ (إضافة/تعديل) ─── */
  const openQuoteForm = (q?: QuoteRow) => {
    setQErr("");
    if (q) {
      setQEditId(q.id);
      setQTextAr(q.textAr);
      setQTextFr(q.textFr);
      setQTextEn(q.textEn);
      setQAuthor(q.author || "");
      setQCategory(q.category);
    } else {
      setQEditId(null);
      setQTextAr("");
      setQTextFr("");
      setQTextEn("");
      setQAuthor("");
      setQCategory("wisdom");
    }
    setShowQuoteForm(true);
  };

  const saveQuote = async () => {
    setQErr("");
    if (!qTextAr.trim() || !qTextFr.trim() || !qTextEn.trim()) {
      setQErr(t.quote.missingLangs);
      return;
    }
    setQBusy(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: qEditId ? "update" : "create",
          id: qEditId,
          textAr: qTextAr.trim(),
          textFr: qTextFr.trim(),
          textEn: qTextEn.trim(),
          author: qAuthor.trim(),
          category: qCategory,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        playSound("success");
        setShowQuoteForm(false);
        load();
      } else if (data.error === "MISSING_LANGUAGES") setQErr(t.quote.missingLangs);
      else setQErr(t.common.error);
    } finally {
      setQBusy(false);
    }
  };

  const toggleQuote = async (q: QuoteRow) => {
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: q.id, active: !q.active }),
    });
    load();
  };

  const deleteQuote = async () => {
    if (!qDeleteTarget) return;
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: qDeleteTarget.id }),
    });
    setQDeleteTarget(null);
    playSound("success");
    load();
  };

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-muted-foreground font-semibold">{t.admin.loginDesc}</p>
        <Button className="gradient-primary text-white font-bold" onClick={() => setView("admin-login")}>
          {t.admin.loginSubmit}
        </Button>
      </div>
    );
  }

  const asList = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
  const roleBadge = (role: string) =>
    role === "VICTIM"
      ? "bg-primary/15 text-primary border-0"
      : role === "COUNSELOR"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0"
        : "bg-destructive/15 text-destructive border-0";
  const roleLabel = (role: string) =>
    role === "VICTIM" ? t.admin.roleVICTIM : role === "COUNSELOR" ? t.admin.roleCOUNSELOR : t.admin.roleADMIN;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-12">
      <BackButton />
      <div className="flex items-center justify-between gap-3 mb-7 flex-wrap">
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-black">
          {t.admin.panelTitle}
        </motion.h1>
        {/* v2.8.0: تحديث اللوحة دون تحديث الموقع كاملاً */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg font-bold border-primary/40 text-primary"
          disabled={refreshing}
          onClick={() => void refreshPanel()}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? t.common.loading : t.admin.refreshBtn}
        </Button>
      </div>

      {/* stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Users, value: stats.users, label: t.admin.statUsers },
          { icon: CalendarCheck2, value: stats.sessions, label: t.admin.statSessions },
          { icon: BadgeCheck, value: stats.verifiedCounselors, label: t.admin.statCounselors },
          { icon: HeartPulse, value: stats.crises, label: t.admin.statCrisis },
        ].map((s) => (
          <Card key={s.label} className="border-border/70">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-black font-mono leading-none">{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-semibold mt-1">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── v2.7.0: بطاقة فائز التحدي — تظهر دائماً في لوحة الإدارة ─── */}
      {challengeWinner && (
        <Card className="border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent mb-7">
          <CardContent className="p-5 flex flex-wrap items-center gap-4">
            <div className="relative shrink-0">
              <div className="absolute -top-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-20 drop-shadow">
                <RoyalCrown size={30} />
              </div>
              {challengeWinner.profileId ? (
                <Avatar className="h-14 w-14 rounded-2xl ring-2 ring-amber-400/70">
                  <AvatarImage src={`/api/counselors/${challengeWinner.profileId}/photo`} alt={challengeWinner.name} className="rounded-2xl object-cover" />
                  <AvatarFallback className="gradient-primary text-white rounded-2xl font-black text-xl">
                    {challengeWinner.name.replace("د. ", "").charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-14 w-14 rounded-2xl gradient-primary text-white flex items-center justify-center font-black text-xl ring-2 ring-amber-400/70">
                  {challengeWinner.name.replace("د. ", "").charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-60">
              <h2 className="font-black text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {t.admin.challengeWinnerTitle}
              </h2>
              <p className="font-black text-base mt-0.5">{challengeWinner.name}</p>
              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 font-mono" dir="ltr">
                {challengeWinner.wonAt ? formatDateTime(challengeWinner.wonAt) : ""}
              </p>
            </div>
            {challengeWinner.profileId && (
              <a
                href={`/counselor/${challengeWinner.profileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-primary hover:underline"
              >
                {t.admin.challengeWinnerProfile}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── v2.6.0: لافتة الطلبات المتأخرة +36 ساعة — تحتاج تدخل الأدمين ─── */}
      {overdue.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 mb-7">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                <AlarmClock className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h2 className="font-black text-sm text-destructive">
                  {t.admin.overdueBannerTitle} ({overdue.length})
                </h2>
                <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{t.admin.overdueBannerDesc}</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
              {overdue.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl bg-card border border-destructive/30 px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                >
                  <Badge className="bg-destructive/15 text-destructive border-0 font-black shrink-0">
                    {t.admin.overdueHours.replace("{h}", String(o.hoursPending))}
                  </Badge>
                  <span className="font-bold">{o.counselorName ?? o.counselorId}</span>
                  <span className="text-muted-foreground">
                    ← {t.admin.requestsVictim}: <span className="font-bold text-foreground">{o.victimAlias ?? "—"}</span>
                  </span>
                  <span className="text-muted-foreground font-mono" dir="ltr">
                    {formatDateTime(o.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4 flex-wrap h-auto">
          {/* ─── v2.9.0: لوحة القيادة — كل الإحصائيات في صفحة واحدة ─── */}
          <TabsTrigger value="dashboard" className="font-bold flex items-center gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t.admin.tabDashboard}
            {firePendingCount > 0 && (
              <span className="ms-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5">{firePendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="victimVerify" className="font-bold flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5" />
            {t.admin.tabVictimVerify}
          </TabsTrigger>
          <TabsTrigger value="inbox" className="font-bold flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            {t.adminChat.adminTab}
          </TabsTrigger>
          <TabsTrigger value="verify" className="font-bold">{t.admin.tabVerify}</TabsTrigger>
          <TabsTrigger value="accounts" className="font-bold">{t.admin.tabAccounts}</TabsTrigger>
          <TabsTrigger value="feedback" className="font-bold">
            {t.admin.tabFeedback}
            {feedbacks.length > 0 && (
              <span className="ms-1.5 rounded-full bg-primary text-white text-[10px] font-black px-1.5 py-0.5">
                {feedbacks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="font-bold">{t.admin.tabStats}</TabsTrigger>
          <TabsTrigger value="crisis" className="font-bold">{t.admin.tabCrisis}</TabsTrigger>
          <TabsTrigger value="quotes" className="font-bold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {t.quote.adminTab}
            <span className="ms-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-black px-1.5 py-0.5">
              {quotes.filter((q) => q.active).length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="gratitude" className="font-bold flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            {t.gratitude.adminTab}
          </TabsTrigger>
          {/* ─── v2.8.0: الطلبات الملغاة + الإشعار الجماعي + المؤسسون ─── */}
          <TabsTrigger value="cancelled" className="font-bold flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" />
            {t.admin.tabCancelled}
            {cancelled.length > 0 && (
              <span className="ms-1 rounded-full bg-destructive text-white text-[10px] font-black px-1.5 py-0.5">{cancelled.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bulk" className="font-bold flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            {t.admin.bulkTab}
          </TabsTrigger>
          <TabsTrigger value="founders" className="font-bold flex items-center gap-1.5">
            <HeartHandshake className="h-3.5 w-3.5" />
            {t.admin.foundersTab}
          </TabsTrigger>
        </TabsList>

        {/* ─── v2.9.0: لوحة القيادة ─── */}
        <TabsContent value="dashboard" className="space-y-3">
          <DashboardTab />
        </TabsContent>

        {/* ─── v2.9.0: توثيق المتضررين من الحرائق ─── */}
        <TabsContent value="victimVerify" className="space-y-3">
          <VictimVerifyTab onReviewed={load} />
        </TabsContent>

        {/* ─── v2.10.0: محادثات المختصين مع الإدارة ─── */}
        <TabsContent value="inbox" className="space-y-3">
          <AdminInboxTab />
        </TabsContent>

        {/* ─── توثيق الأخصائيين ─── */}
        <TabsContent value="verify" className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground">{t.admin.pendingRequests}</h2>
          {pending.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.admin.noPending}
              </CardContent>
            </Card>
          ) : (
            pending.map((p) => (
              <Card key={p.id} className="border-border/70">
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-black">{p.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono" dir="ltr">{p.email}</div>
                      {p.whatsapp && (
                        <div className="text-xs font-semibold text-[#128C4A] flex items-center gap-1" dir="ltr">
                          <span>🟢</span> {formatWhatsapp(p.whatsapp)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gradient-primary text-white font-bold rounded-lg" onClick={() => act(p.id, "verify")}>
                        <BadgeCheck className="h-4 w-4" />
                        {t.admin.verify}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg text-destructive border-destructive/40" onClick={() => act(p.id, "reject")}>
                        <XCircle className="h-4 w-4" />
                        {t.admin.reject}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {asList(p.specialties).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px] font-semibold">
                        {t.victim.specialties[s as keyof typeof t.victim.specialties] ?? s}
                      </Badge>
                    ))}
                    {asList(p.languages).map((l) => (
                      <Badge key={l} variant="outline" className="text-[11px] font-bold">
                        {l === "ar" ? "العربية" : l === "fr" ? "FR" : "EN"}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-[11px] font-bold">
                      {p.yearsExperience} {t.victim.yearsExp}
                    </Badge>
                  </div>
                  {p.bio && <p className="text-xs text-muted-foreground leading-relaxed">{p.bio}</p>}
                  {p.diplomaImage && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground">🎓 {t.admin.diplomaImageLabel}</span>
                      <button
                        onClick={() => setZoomImg(p.diplomaImage || null)}
                        className="block rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all"
                        title={t.admin.zoomHint}
                      >
                        <img
                          src={p.diplomaImage}
                          alt={t.admin.diplomaImageLabel}
                          className="max-h-40 w-auto object-contain bg-muted/40"
                        />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── إدارة الحسابات — صلاحيات كاملة ─── */}
        <TabsContent value="accounts" className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h2 className="font-black text-sm">{t.admin.accountsTitle}</h2>
                  <p className="text-[11px] text-muted-foreground font-semibold">{t.admin.accountsHint}</p>
                </div>
                <Button size="sm" className="gradient-primary text-white font-bold rounded-lg" onClick={() => setShowCreate(true)}>
                  <UserPlus className="h-4 w-4" />
                  {t.admin.createAccount}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter} dir={lang === "ar" ? "rtl" : "ltr"}>
                  <SelectTrigger className="w-36 h-9 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t.admin.roleAll}</SelectItem>
                    <SelectItem value="VICTIM">{t.admin.roleVICTIM}</SelectItem>
                    <SelectItem value="COUNSELOR">{t.admin.roleCOUNSELOR}</SelectItem>
                    <SelectItem value="ADMIN">{t.admin.roleADMIN}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-52">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.admin.searchUsers}
                    className="ps-9 h-9 rounded-xl bg-card text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {usersLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-16 animate-pulse bg-muted/50 border-0" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.admin.noUsers}
              </CardContent>
            </Card>
          ) : (
            users.map((u) => (
              <Card key={u.id} className="border-border/70">
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary">
                    {(u.fullName || u.pseudonym || "?").trim().charAt(0)}
                  </div>
                  <div className="flex-1 min-w-44">
                    <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                      {u.fullName || u.pseudonym || "—"}
                      <Badge className={`text-[10px] font-black ${roleBadge(u.role)}`}>{roleLabel(u.role)}</Badge>
                      {u.verificationStatus === "VERIFIED" && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-0 gap-0.5">
                          <BadgeCheck className="h-3 w-3" />
                          {t.admin.verifiedOk}
                        </Badge>
                      )}
                      {/* v2.6.0: شارة الحساب المعلّق + سبب التعليق التلقائي */}
                      {u.suspended && (
                        <Badge className="text-[10px] bg-destructive/15 text-destructive border-0 gap-0.5">
                          <XCircle className="h-3 w-3" />
                          {t.admin.suspendBadge}
                          {u.role === "COUNSELOR" && (u.lateCount ?? 0) >= 3 && ` · ${t.admin.autoSuspendNote}`}
                        </Badge>
                      )}
                      {!u.suspended && u.role === "COUNSELOR" && (u.lateCount ?? 0) > 0 && (
                        <Badge className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0">
                          {t.admin.lateCountLabel}: {u.lateCount}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-semibold mt-0.5 flex flex-wrap items-center gap-x-3" dir="auto">
                      {u.email && <span className="font-mono" dir="ltr">{u.email}</span>}
                      {u.whatsapp && <span className="font-mono" dir="ltr">{formatWhatsapp(u.whatsapp)}</span>}
                      {u.wilaya && <span>{u.wilaya}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 ms-auto flex-wrap justify-end">
                    {/* v2.6.0: الطلبات المعلّقة لهذا الأخصائي — بكل تفاصيلها */}
                    {u.role === "COUNSELOR" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold h-8"
                        title={t.admin.requestsBtn}
                        onClick={() => void openRequests(u)}
                      >
                        <Inbox className="h-3.5 w-3.5" />
                        {t.admin.requestsBtn}
                      </Button>
                    )}
                    {/* v2.6.0: تفعيل / تعطيل أي حساب أخصائي أو متضرر */}
                    {(u.role === "COUNSELOR" || u.role === "VICTIM") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`rounded-lg font-bold h-8 ${u.suspended ? "text-primary border-primary/40" : "text-destructive border-destructive/40"}`}
                        disabled={toggleBusy === u.id}
                        onClick={() => void toggleSuspend(u)}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {u.suspended ? t.admin.activateBtn : t.admin.deactivateBtn}
                      </Button>
                    )}
                    {/* شهادة التطوع — للأخصائيين فقط (v2.5.3): تُفتح في تبويب جديد */}
                    {u.role === "COUNSELOR" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold h-8"
                        title={t.admin.certificateBtn}
                        onClick={() => window.open(`/certificate/${u.id}?lang=${lang}`, "_blank")}
                      >
                        <Award className="h-3.5 w-3.5" />
                        {t.admin.certificateBtn}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg font-bold h-8"
                      onClick={() => {
                        setPwTarget(u);
                        setPwValue("");
                        setPwMsg("");
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {t.admin.setPwBtn}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-destructive border-destructive/40 h-8"
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.common.delete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── الملاحظات والبلاغات ─── */}
        <TabsContent value="feedback" className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground">{t.admin.feedbackListTitle}</h2>
          {feedbacks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.admin.feedbackEmpty}
              </CardContent>
            </Card>
          ) : (
            feedbacks.map((f) => (
              <Card key={f.id} className="border-border/70">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={`text-[10px] font-black border-0 ${
                        f.type === "bug"
                          ? "bg-destructive/15 text-destructive"
                          : f.type === "suggestion"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-primary/15 text-primary"
                      }`}
                    >
                      {t.feedback.types[f.type as keyof typeof t.feedback.types] ?? f.type}
                    </Badge>
                    {f.subject && <span className="font-bold text-sm">{f.subject}</span>}
                    <span className="text-[10px] text-muted-foreground font-semibold ms-auto font-mono">
                      {formatDateTime(f.createdAt)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive font-bold"
                      onClick={() => deleteFeedback(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.common.delete}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed" dir="auto">{f.message}</p>
                  {f.contact && (
                    <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <MessageSquareHeart className="h-3.5 w-3.5 text-primary" />
                      {t.admin.feedbackContact}: <span className="font-mono" dir="ltr">{f.contact}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── الإحصائيات + تصدير Excel ─── */}
        <TabsContent value="stats" className="space-y-4">
          <Card className="border-border/70">
            <CardContent className="p-8 text-center space-y-3">
              <BarChart3 className="h-10 w-10 mx-auto text-primary/60" />
              <div className="grid grid-cols-2 gap-4 pt-3">
                <div>
                  <div className="text-3xl font-black font-mono text-primary">{stats.completed}</div>
                  <div className="text-xs text-muted-foreground font-semibold">{t.counselor.statsDone}</div>
                </div>
                <div>
                  <div className="text-3xl font-black font-mono text-primary">{stats.sessions}</div>
                  <div className="text-xs text-muted-foreground font-semibold">{t.admin.statSessions}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* تصدير البيانات إلى Excel (CSV) */}
          <Card className="border-border/70">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-primary" />
                <h3 className="font-black">{t.admin.exportTitle}</h3>
              </div>
              <p className="text-xs text-muted-foreground font-semibold">{t.admin.exportDesc}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {([
                  { key: "users", label: t.admin.exportUsers },
                  { key: "sessions", label: t.admin.exportSessions },
                  { key: "crisis", label: t.admin.exportCrisis },
                  { key: "feedback", label: t.admin.exportFeedback },
                ] as const).map((e) => (
                  <Button
                    key={e.key}
                    variant="outline"
                    className="rounded-xl font-bold justify-start"
                    disabled={exportBusy !== null}
                    onClick={() => void doExport(e.key)}
                  >
                    <Download className="h-4 w-4 text-primary" />
                    {exportBusy === e.key ? t.common.loading : e.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── سجل الأزمات ─── */}
        <TabsContent value="crisis" className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground">{t.admin.crisisLogTitle}</h2>
          {crisis.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.admin.crisisEmpty}
              </CardContent>
            </Card>
          ) : (
            crisis.map((c) => (
              <Card key={c.id} className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <HeartPulse className="h-5 w-5 text-destructive shrink-0" />
                    <span className="font-mono font-bold text-destructive" dir="auto">“{c.phrase}”</span>
                    <span className="text-xs text-muted-foreground font-semibold font-mono">
                      {formatDateTime(c.createdAt)}
                    </span>
                    <Badge variant="outline" className="ms-auto text-[10px]">{c.source}</Badge>
                  </div>
                  {/* من كتب العبارة + طرفا الجلسة (المتضرر المستعار والأخصائي) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold ps-8">
                    {c.saidBy === "VICTIM" || c.saidBy === "COUNSELOR" ? (
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${
                          c.saidBy === "VICTIM"
                            ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                            : "border-primary/40 text-primary"
                        }`}
                      >
                        <HeartPulse className="h-3 w-3" />
                        {c.saidBy === "VICTIM" ? t.admin.crisisSaidByVictim : t.admin.crisisSaidByCounselor}
                      </Badge>
                    ) : null}
                    {c.victimAlias && (
                      <span className="text-muted-foreground">
                        {t.admin.crisisVictim}: <span className="text-foreground font-black" dir="auto">{c.victimAlias}</span>
                      </span>
                    )}
                    {c.counselorName && (
                      <span className="text-muted-foreground">
                        {t.admin.crisisCounselor}: <span className="text-foreground font-black" dir="auto">{c.counselorName}</span>
                      </span>
                    )}
                    {!c.victimAlias && !c.counselorName && (
                      <span className="text-muted-foreground/70 font-semibold">{t.admin.crisisNoSession}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── عبارات الاطمئنان (نافذة الولوج) ─── */}
        <TabsContent value="quotes" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-sm text-muted-foreground">{t.quote.adminDesc}</h2>
              <p className="text-[11px] text-muted-foreground/70 font-semibold mt-0.5">
                {quotes.filter((q) => q.active).length} {t.quote.countLabel} · {t.quote.seedNote}
              </p>
            </div>
            <Button size="sm" className="gradient-primary text-white font-bold rounded-lg" onClick={() => openQuoteForm()}>
              <Plus className="h-4 w-4" />
              {t.quote.addBtn}
            </Button>
          </div>

          {quotes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.quote.empty}
              </CardContent>
            </Card>
          ) : (
            quotes.map((q) => (
              <Card key={q.id} className={`border-border/70 ${!q.active ? "opacity-60" : ""}`}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <QuoteIcon className="h-4 w-4 text-primary shrink-0" />
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {q.category === "religious" ? t.quote.catReligious : q.category === "social" ? t.quote.catSocial : t.quote.catWisdom}
                    </Badge>
                    {!q.active && (
                      <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/40">
                        {t.quote.inactiveLabel}
                      </Badge>
                    )}
                    <div className="ms-auto flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold" onClick={() => openQuoteForm(q)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {t.quote.edit}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold" onClick={() => toggleQuote(q)}>
                        {q.active ? t.quote.inactiveLabel : t.quote.activeLabel}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-lg text-destructive border-destructive/40" onClick={() => setQDeleteTarget(q)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-bold leading-relaxed" dir="auto">{q.textAr}</p>
                  <p className="text-xs text-muted-foreground font-semibold leading-relaxed" dir="auto">{q.textFr}</p>
                  <p className="text-xs text-muted-foreground font-semibold leading-relaxed" dir="auto">{q.textEn}</p>
                  {q.author && (
                    <span className="inline-block text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-2.5 py-0.5" dir="auto">
                      {q.author}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── صفحة الشكر والعرفان: محرر النص + الرمز ─── */}
        <TabsContent value="gratitude" className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground">{t.gratitude.adminDesc}</h2>
          {!grat ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/70">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.gratitude.textArLabel} *</Label>
                  <Textarea
                    value={grat.textAr}
                    onChange={(e) => setGrat({ ...grat, textAr: e.target.value })}
                    dir="auto"
                    className="rounded-xl min-h-32"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.gratitude.textFrLabel} *</Label>
                    <Textarea
                      value={grat.textFr}
                      onChange={(e) => setGrat({ ...grat, textFr: e.target.value })}
                      dir="auto"
                      className="rounded-xl min-h-32"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.gratitude.textEnLabel} *</Label>
                    <Textarea
                      value={grat.textEn}
                      onChange={(e) => setGrat({ ...grat, textEn: e.target.value })}
                      dir="auto"
                      className="rounded-xl min-h-32"
                    />
                  </div>
                </div>

                {/* رمز الخلفية الطافية */}
                <div className="space-y-2">
                  <Label className="font-bold">{t.gratitude.symbolLabel}</Label>
                  <p className="text-[11px] text-muted-foreground font-semibold">{t.gratitude.symbolHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {["❤️", "💛", "💚", "💙", "🧡", "🌹", "🌟", "✨", "🕊️", "💐", "🤲", "🫶", "🌸"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setGrat({ ...grat, symbol: s })}
                        className={`h-10 w-10 rounded-xl border-2 text-lg flex items-center justify-center transition-all ${
                          grat.symbol === s ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {gratErr && <div className="rounded-xl bg-destructive/10 text-destructive text-xs font-bold px-3 py-2">{gratErr}</div>}
                {gratMsg && <div className="rounded-xl bg-primary/10 text-primary text-xs font-bold px-3 py-2">{gratMsg}</div>}
                <Button className="gradient-primary text-white font-bold rounded-lg" disabled={gratBusy} onClick={saveGratitude}>
                  {gratBusy ? t.common.loading : t.common.save}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── v2.8.0: الطلبات الملغاة — كل طلب بتفاصيله في نافذة منبثقة ─── */}
        <TabsContent value="cancelled" className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground">{t.admin.tabCancelled}</h2>
          {cancelled.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.admin.cancelledEmpty}
              </CardContent>
            </Card>
          ) : (
            cancelled.map((c) => (
              <Card key={c.id} className="border-border/70">
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <Ban className="h-4.5 w-4.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-44">
                    <div className="font-bold text-sm flex items-center gap-2 flex-wrap" dir="auto">
                      {c.victimAlias ?? "—"}
                      <span className="text-muted-foreground font-semibold">←</span>
                      {c.counselorName ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-semibold mt-0.5 flex flex-wrap gap-x-3" dir="auto">
                      <span>{c.topic ? t.victim.topics[c.topic as keyof typeof t.victim.topics] ?? c.topic : "—"}</span>
                      {c.cancelledAt && <span className="font-mono" dir="ltr">{formatDateTime(c.cancelledAt)}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg font-bold h-8" onClick={() => setCancelledDetails(c)}>
                    <Eye className="h-3.5 w-3.5" />
                    {t.admin.detailsBtn}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── v2.8.0: الإشعار الجماعي ─── */}
        <TabsContent value="bulk" className="space-y-4">
          <Card className="border-border/70">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4.5 w-4.5 text-primary" />
                <h3 className="font-black">{t.admin.bulkTitle}</h3>
              </div>
              <p className="text-xs text-muted-foreground font-semibold">{t.admin.bulkDesc}</p>

              <div className="space-y-1.5">
                <Label className="font-bold">{t.admin.bulkTarget}</Label>
                <Select value={bulkTarget} onValueChange={(v) => setBulkTarget(v as typeof bulkTarget)} dir={lang === "ar" ? "rtl" : "ltr"}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_VICTIMS">{t.admin.bulkTargetVictims}</SelectItem>
                    <SelectItem value="ALL_COUNSELORS">{t.admin.bulkTargetCounselors}</SelectItem>
                    <SelectItem value="ALL">{t.admin.bulkTargetAll}</SelectItem>
                    <SelectItem value="USER">{t.admin.bulkTargetUser}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkTarget === "USER" && (
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.bulkUserLabel}</Label>
                  <Input value={bulkUserId} onChange={(e) => setBulkUserId(e.target.value)} dir="ltr" className="rounded-xl bg-card font-mono" placeholder="67f…" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="font-bold">{t.admin.bulkTextAr}</Label>
                <Textarea value={bulkAr} onChange={(e) => setBulkAr(e.target.value)} dir="auto" className="rounded-xl min-h-20" maxLength={500} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.bulkTextFr}</Label>
                  <Textarea value={bulkFr} onChange={(e) => setBulkFr(e.target.value)} dir="auto" className="rounded-xl min-h-16" maxLength={500} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.bulkTextEn}</Label>
                  <Textarea value={bulkEn} onChange={(e) => setBulkEn(e.target.value)} dir="auto" className="rounded-xl min-h-16" maxLength={500} />
                </div>
              </div>

              {bulkErr && <div className="rounded-xl bg-destructive/10 text-destructive text-xs font-bold px-3 py-2">{bulkErr}</div>}
              {bulkMsg && <div className="rounded-xl bg-primary/10 text-primary text-xs font-bold px-3 py-2">{bulkMsg}</div>}
              <Button className="gradient-primary text-white font-bold rounded-lg" disabled={bulkBusy} onClick={() => void sendBulk()}>
                <Megaphone className="h-4 w-4" />
                {bulkBusy ? t.common.loading : t.admin.bulkSend}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── v2.8.0: صفحة المؤسسين — محرر كامل ─── */}
        <TabsContent value="founders" className="space-y-4">
          <h2 className="font-bold text-sm text-muted-foreground">{t.admin.foundersDesc}</h2>
          {!founders ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground font-semibold">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/70">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.foundersIntroAr}</Label>
                  <Textarea value={founders.textAr} onChange={(e) => setFounders({ ...founders, textAr: e.target.value })} dir="auto" className="rounded-xl min-h-24" />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.foundersIntroFr}</Label>
                    <Textarea value={founders.textFr} onChange={(e) => setFounders({ ...founders, textFr: e.target.value })} dir="auto" className="rounded-xl min-h-20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.foundersIntroEn}</Label>
                    <Textarea value={founders.textEn} onChange={(e) => setFounders({ ...founders, textEn: e.target.value })} dir="auto" className="rounded-xl min-h-20" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.foundersDeveloperName}</Label>
                    <Input value={founders.developerName} onChange={(e) => setFounders({ ...founders, developerName: e.target.value })} dir="auto" className="rounded-xl bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.foundersDeveloperRole}</Label>
                    <Input value={founders.developerRole} onChange={(e) => setFounders({ ...founders, developerRole: e.target.value })} dir="auto" className="rounded-xl bg-card" />
                  </div>
                </div>

                {/* قائمة الأخصائيين النفسانيين */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="font-bold">{t.admin.foundersMembers}</Label>
                    <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setFounders({ ...founders, members: [...founders.members, { name: "", role: "" }] })}>
                      <PlusCircle className="h-3.5 w-3.5" />
                      {t.admin.foundersAddMember}
                    </Button>
                  </div>
                  {founders.members.length === 0 && (
                    <p className="text-[11px] text-muted-foreground font-semibold">{t.founders.empty}</p>
                  )}
                  {founders.members.map((m, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input
                        value={m.name}
                        onChange={(e) => {
                          const members = [...founders.members];
                          members[i] = { ...members[i], name: e.target.value };
                          setFounders({ ...founders, members });
                        }}
                        placeholder={t.admin.foundersMemberName}
                        dir="auto"
                        className="rounded-xl bg-card flex-1 min-w-36"
                      />
                      <Input
                        value={m.role}
                        onChange={(e) => {
                          const members = [...founders.members];
                          members[i] = { ...members[i], role: e.target.value };
                          setFounders({ ...founders, members });
                        }}
                        placeholder={t.admin.foundersMemberRole}
                        dir="auto"
                        className="rounded-xl bg-card flex-1 min-w-36"
                      />
                      <Button size="sm" variant="outline" className="rounded-lg text-destructive border-destructive/40 h-9" onClick={() => setFounders({ ...founders, members: founders.members.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.admin.foundersRemove}
                      </Button>
                    </div>
                  ))}
                </div>

                {foundersErr && <div className="rounded-xl bg-destructive/10 text-destructive text-xs font-bold px-3 py-2">{foundersErr}</div>}
                {foundersMsg && <div className="rounded-xl bg-primary/10 text-primary text-xs font-bold px-3 py-2">{foundersMsg}</div>}
                <Button className="gradient-primary text-white font-bold rounded-lg" disabled={foundersBusy} onClick={() => void saveFounders()}>
                  {foundersBusy ? t.common.loading : t.common.save}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* تكبير صورة الشهادة */}
      <Dialog open={!!zoomImg} onOpenChange={(o) => !o && setZoomImg(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-start">{t.admin.diplomaImageLabel}</DialogTitle>
          </DialogHeader>
          {zoomImg && <img src={zoomImg} alt={t.admin.diplomaImageLabel} className="w-full max-h-[70vh] object-contain rounded-xl bg-muted/40" />}
        </DialogContent>
      </Dialog>

      {/* إضافة / تعديل عبارة اطمئنان */}
      <Dialog open={showQuoteForm} onOpenChange={setShowQuoteForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start">{qEditId ? t.quote.editTitle : t.quote.addTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="font-bold">{t.quote.textArLabel} *</Label>
              <Textarea value={qTextAr} onChange={(e) => setQTextAr(e.target.value)} dir="auto" className="rounded-xl min-h-16" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">{t.quote.textFrLabel} *</Label>
              <Textarea value={qTextFr} onChange={(e) => setQTextFr(e.target.value)} dir="auto" className="rounded-xl min-h-16" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">{t.quote.textEnLabel} *</Label>
              <Textarea value={qTextEn} onChange={(e) => setQTextEn(e.target.value)} dir="auto" className="rounded-xl min-h-16" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">{t.quote.authorLabel}</Label>
              <Input value={qAuthor} onChange={(e) => setQAuthor(e.target.value)} dir="auto" className="rounded-xl bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">{t.quote.categoryLabel}</Label>
              <Select value={qCategory} onValueChange={setQCategory} dir={lang === "ar" ? "rtl" : "ltr"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="religious">{t.quote.catReligious}</SelectItem>
                  <SelectItem value="social">{t.quote.catSocial}</SelectItem>
                  <SelectItem value="wisdom">{t.quote.catWisdom}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {qErr && <p className="text-xs font-bold text-destructive">{qErr}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-lg font-bold" onClick={() => setShowQuoteForm(false)} disabled={qBusy}>
                {t.common.cancel}
              </Button>
              <Button className="gradient-primary text-white rounded-lg font-bold" onClick={saveQuote} disabled={qBusy}>
                {t.common.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأكيد حذف عبارة */}
      <AlertDialog open={!!qDeleteTarget} onOpenChange={(o) => !o && setQDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-start">{t.quote.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">{t.quote.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white font-bold" onClick={deleteQuote}>
              {t.quote.deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* إنشاء حساب جديد */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        {/* v2.9.0: النافذة تقبل التمرير نحو الأعلى والأسفل على كل الشاشات */}
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-start">{t.admin.createAccount}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-bold">{t.admin.createRole}</Label>
              <Select value={createRole} onValueChange={(v) => setCreateRole(v as "VICTIM" | "COUNSELOR")} dir={lang === "ar" ? "rtl" : "ltr"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VICTIM">{t.admin.roleVICTIM}</SelectItem>
                  <SelectItem value="COUNSELOR">{t.admin.roleCOUNSELOR}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createRole === "VICTIM" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createPseudonym} *</Label>
                  <Input value={cPseudonym} onChange={(e) => setCPseudonym(e.target.value)} className="rounded-xl bg-card" dir="auto" />
                </div>
                {/* v2.8.0: كل الحقول مثل التسجيل العادي */}
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createWilaya}</Label>
                  <Select value={cWilaya} onValueChange={setCWilaya} dir={lang === "ar" ? "rtl" : "ltr"}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t.victim.wilayaOptional} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {WILAYA_LIST.map((w) => (
                        <SelectItem key={w.key} value={w.key}>
                          {w.code} — {WILAYA_LABELS[w.key]?.[lang] ?? w.ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.createAgeGroup}</Label>
                    <Select value={cAgeGroup} onValueChange={setCAgeGroup} dir={lang === "ar" ? "rtl" : "ltr"}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(AGE_LABELS).map((k) => (
                          <SelectItem key={k} value={k}>
                            {AGE_LABELS[k]?.[lang] ?? k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.createGender}</Label>
                    <Select value={cGender} onValueChange={(v) => setCGender(v as "male" | "female" | "")} dir={lang === "ar" ? "rtl" : "ltr"}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t.admin.createGenderMale}</SelectItem>
                        <SelectItem value="female">{t.admin.createGenderFemale}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createPhone}</Label>
                  <Input type="tel" dir="ltr" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="0555123456" className="rounded-xl bg-card font-mono" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createFullName} *</Label>
                  <Input value={cFullName} onChange={(e) => setCFullName(e.target.value)} className="rounded-xl bg-card" dir="auto" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createEmail} *</Label>
                  <Input type="email" dir="ltr" value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="rounded-xl bg-card" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createWhatsapp}</Label>
                  <Input type="tel" dir="ltr" value={cWhatsapp} onChange={(e) => setCWhatsapp(e.target.value)} placeholder="0555123456" className="rounded-xl bg-card font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createSpecialties}</Label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map((sp) => (
                      <label key={sp} className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 transition-colors">
                        <Checkbox
                          checked={cSpecialties.includes(sp)}
                          onCheckedChange={(v) => setCSpecialties((cur) => (v === true ? [...cur, sp] : cur.filter((x) => x !== sp)))}
                        />
                        <span className="text-[11px] font-bold">{t.victim.specialties[sp]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createLanguages}</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["ar", "fr", "en"] as const).map((lg) => (
                      <label key={lg} className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 transition-colors">
                        <Checkbox
                          checked={cLanguages.includes(lg)}
                          onCheckedChange={(v) => setCLanguages((cur) => (v === true ? [...cur, lg] : cur.filter((x) => x !== lg)))}
                        />
                        <span className="text-[11px] font-bold">{lg === "ar" ? "العربية" : lg === "fr" ? "Français" : "English"}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold">{t.admin.createYearsExp}</Label>
                    <Input type="number" min={0} max={60} dir="ltr" value={cYearsExp} onChange={(e) => setCYearsExp(e.target.value)} className="rounded-xl bg-card font-mono" />
                  </div>
                  <label className="flex items-end gap-2 cursor-pointer pb-2.5">
                    <Checkbox checked={cVerified} onCheckedChange={(v) => setCVerified(v === true)} />
                    <span className="text-xs font-bold">{t.admin.createVerified}</span>
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.admin.createBio}</Label>
                  <Textarea value={cBio} onChange={(e) => setCBio(e.target.value)} dir="auto" className="rounded-xl min-h-16" />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="font-bold">{t.admin.createPassword} *</Label>
              <Input type="password" dir="ltr" value={cPassword} onChange={(e) => setCPassword(e.target.value)} className="rounded-xl bg-card font-mono" />
            </div>

            {cErr && <div className="rounded-xl bg-destructive/10 text-destructive text-xs font-bold px-3 py-2">{cErr}</div>}
            {cMsg && (
              <div className="rounded-xl bg-primary/10 text-primary text-xs font-bold px-3 py-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {cMsg}
              </div>
            )}
            <Button className="w-full gradient-primary text-white font-black rounded-xl h-11" disabled={cBusy} onClick={createAccount}>
              {cBusy ? t.common.loading : t.admin.createSubmit}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تعيين كلمة مرور جديدة */}
      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-start">{t.admin.setPwTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pwTarget && (
              <p className="text-xs font-bold text-muted-foreground">
                {t.admin.setPwFor}: <span className="text-foreground">{pwTarget.fullName || pwTarget.pseudonym || pwTarget.email}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="font-bold">{t.victim.newPasswordLabel} *</Label>
              <Input type="password" dir="ltr" value={pwValue} onChange={(e) => setPwValue(e.target.value)} className="rounded-xl bg-card font-mono" />
            </div>
            {pwMsg && (
              <div className={`rounded-xl text-xs font-bold px-3 py-2 ${pwMsg === t.admin.setPwOk ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                {pwMsg}
              </div>
            )}
            <Button className="w-full gradient-primary text-white font-black rounded-xl h-11" disabled={pwBusy} onClick={setPw}>
              <KeyRound className="h-4 w-4" />
              {pwBusy ? t.common.loading : t.admin.setPwBtn}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأكيد حذف الحساب */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-start">{t.admin.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {deleteTarget && (
                <span className="font-bold text-foreground">
                  {deleteTarget.fullName || deleteTarget.pseudonym || deleteTarget.email}
                  {" — "}
                </span>
              )}
              {t.admin.deleteConfirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter dir={lang === "ar" ? "rtl" : "ltr"}>
            <AlertDialogCancel className="font-bold">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 font-black"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {deleteBusy ? t.common.loading : t.admin.deleteYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── v2.6.0: الطلبات المعلّقة لهذا الأخصائي — بكل تفاصيلها ───
          الاسم المستعار للمتضرر + تاريخ الإنشاء الكامل YYYY/MM/DD HH:MM:SS
          + تفاصيل الطلب (الموضوع، الوسيط، الموعد المطلوب) + شارة التأخر */}
      <Dialog open={!!reqTarget} onOpenChange={(o) => !o && setReqTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary shrink-0" />
              {t.admin.requestsTitle}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs font-bold text-muted-foreground -mt-2">
            {reqTarget?.fullName || reqTarget?.pseudonym || "—"}
          </p>
          <div className="max-h-[55vh] overflow-y-auto space-y-2.5 pe-1 scrollbar-thin">
            {reqLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : reqList.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
                {t.admin.requestsEmpty}
              </div>
            ) : (
              reqList.map((r) => {
                const isOverdue = r.hoursPending >= 36;
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border px-3.5 py-3 space-y-2 ${isOverdue ? "border-destructive/40 bg-destructive/5" : "border-border/70 bg-card"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {isOverdue && (
                        <Badge className="bg-destructive/15 text-destructive border-0 font-black shrink-0">
                          <AlarmClock className="h-3 w-3" />
                          {t.admin.overdueHours.replace("{h}", String(r.hoursPending))}
                        </Badge>
                      )}
                      <span className="text-xs font-bold">
                        {t.admin.requestsVictim}: <span className="text-primary">{r.victimAlias ?? "—"}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-semibold flex flex-wrap gap-x-4 gap-y-0.5">
                      <span>
                        {t.admin.requestsCreated}:{" "}
                        <span className="font-mono text-foreground" dir="ltr">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </span>
                      <span>
                        {t.admin.requestsScheduled}:{" "}
                        <span className="font-mono text-foreground" dir="ltr">
                          {formatDateTime(r.scheduledAt)}
                        </span>
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-semibold flex flex-wrap gap-x-4 gap-y-0.5">
                      <span>
                        {t.admin.requestsTopic}:{" "}
                        <span className="font-bold text-foreground">
                          {r.topic ? t.victim.topics[r.topic as keyof typeof t.victim.topics] ?? r.topic : "—"}
                        </span>
                      </span>
                      <span>
                        {t.admin.requestsMode}:{" "}
                        <span className="font-bold text-foreground">{r.mode ? t.session.modes[r.mode as keyof typeof t.session.modes] ?? r.mode : "—"}</span>
                      </span>
                    </div>
                    {/* v2.8.0: حذف الطلب المعلّق مباشرة من المنصة */}
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" className="rounded-lg text-destructive border-destructive/40 font-bold h-7" onClick={() => setDelReqTarget(r)}>
                        <Trash2 className="h-3 w-3" />
                        {t.admin.reqDeleteBtn}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Button variant="outline" className="w-full rounded-xl font-bold" onClick={() => setReqTarget(null)}>
            {t.counselor.completedClose}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ─── v2.8.0: نافذة تفاصيل الطلب الملغى — الاسم المستعار والأخصائي وسبب التعذّر ─── */}
      <Dialog open={!!cancelledDetails} onOpenChange={(o) => !o && setCancelledDetails(null)}>
        {/* v2.9.0: تجاوب النافذة — كل التفاصيل ظاهرة بترتيب جيد على الهاتف والحاسوب */}
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive shrink-0" />
              {t.admin.cancelledTitle}
            </DialogTitle>
          </DialogHeader>
          {cancelledDetails && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground">{t.admin.cancelledVictim}</p>
                  <p className="text-sm font-black" dir="auto">{cancelledDetails.victimAlias ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground">{t.admin.cancelledCounselor}</p>
                  <p className="text-sm font-black" dir="auto">{cancelledDetails.counselorName ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground">{t.admin.cancelledCreated}</p>
                  <p className="text-xs font-bold font-mono" dir="ltr">{cancelledDetails.createdAt ? formatDateTime(cancelledDetails.createdAt) : "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground">{t.admin.cancelledScheduled}</p>
                  <p className="text-xs font-bold font-mono" dir="ltr">{cancelledDetails.scheduledAt ? formatDateTime(cancelledDetails.scheduledAt) : "—"}</p>
                </div>
              </div>
              <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground">{t.admin.cancelledBy}</p>
                <p className="text-sm font-black">
                  {cancelledDetails.cancelledBy === "COUNSELOR"
                    ? t.admin.cancelledWhoCOUNSELOR
                    : cancelledDetails.cancelledBy === "VICTIM"
                      ? t.admin.cancelledWhoVICTIM
                      : cancelledDetails.cancelledBy === "ADMIN"
                        ? t.admin.cancelledWhoADMIN
                        : "—"}
                </p>
              </div>
              <div className={`rounded-xl px-3.5 py-3 space-y-1 ${cancelledDetails.cancelReason ? "bg-destructive/5 border border-destructive/20" : "bg-muted/40"}`}>
                <p className="text-[10px] font-bold text-muted-foreground">{t.admin.cancelledReason}</p>
                <p className="text-sm font-bold leading-relaxed" dir="auto">
                  {cancelledDetails.cancelReason || t.admin.cancelledNoReason}
                </p>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full rounded-xl font-bold" onClick={() => setCancelledDetails(null)}>
            {t.common.close}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ─── v2.8.0: تأكيد حذف الطلب المعلّق ─── */}
      <AlertDialog open={!!delReqTarget} onOpenChange={(o) => !o && setDelReqTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-start">{t.admin.reqDeleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">{t.admin.reqDeleteConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter dir={lang === "ar" ? "rtl" : "ltr"}>
            <AlertDialogCancel className="font-bold">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 font-black"
              disabled={delReqBusy}
              onClick={(e) => {
                e.preventDefault();
                deletePendingRequest();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {delReqBusy ? t.common.loading : t.admin.reqDeleteBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
