"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, CalendarClock, LogIn, XCircle, MessageSquareText, Mic, Video, Crown, Hourglass, Rocket, CalendarDays, CheckCircle2, Ban } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import type { TopicKey, SessionMode } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/shared/back-button";
import { RoyalCrown } from "@/components/shared/crown-badge";

interface SessionRow {
  id: string;
  topic: string;
  mode: SessionMode;
  status: string;
  scheduledAt: string;
  followUpAt?: string | null;
  treatmentEnded?: boolean;
  createdAt: string;
  source?: string | null;
  /* v2.8.0: المدة المختارة عند القبول + سبب الاعتذار عند الرفض */
  durationMinutes?: number | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  victim: { id: string; pseudonym: string };
  counselor: {
    id: string;
    pseudonym: string;
    counselorProfile?: { fullName: string } | null;
  };
}

/* ─── v2.9.0: تحدي الالتزام للمتضررين ─── */
interface VictimChallenge {
  target: number;
  myStreak: number;
  isWinner: boolean;
  winner: { userId: string; name: string; wonAt: string | null } | null;
}

const MODE_ICONS: Record<SessionMode, React.ElementType> = {
  TEXT: MessageSquareText,
  VOICE: Mic,
  VIDEO: Video,
};

/* ترتيب المجموعات كما طلب المستخدم حرفياً:
   1) غرفة مفتوحة الآن (ACTIVE)
   2) مقبولة — جاهزة للدخول (ACCEPTED قريبة)
   3) طلبات جديدة بانتظار القبول (PENDING)
   4) مبرمجة لاحقاً (موعد مستقبلي بعيد / جلسة متابعة)
   5) مكتملة
   6) الملغاة في الأخير */
type GroupKey = "open" | "accepted" | "pending" | "upcoming" | "completed" | "cancelled";

const GROUP_STYLE: Record<GroupKey, { icon: React.ElementType; cls: string; descKey: string | null }> = {
  open: { icon: Rocket, cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30", descKey: "groupOpenDesc" },
  accepted: { icon: LogIn, cls: "text-primary bg-primary/10 border-primary/30", descKey: "groupAcceptedDesc" },
  pending: { icon: Hourglass, cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30", descKey: "groupPendingDesc" },
  upcoming: { icon: CalendarDays, cls: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30", descKey: "groupUpcomingDesc" },
  completed: { icon: CheckCircle2, cls: "text-muted-foreground bg-muted border-border", descKey: null },
  cancelled: { icon: Ban, cls: "text-destructive bg-destructive/10 border-destructive/30", descKey: null },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0",
  ACCEPTED: "bg-primary/15 text-primary border-0",
  ACTIVE: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0 animate-pulse",
  COMPLETED: "bg-muted text-muted-foreground border-0",
  CANCELLED: "bg-destructive/15 text-destructive border-0",
};

const HOUR = 60 * 60 * 1000;

function groupOf(s: SessionRow): GroupKey {
  if (s.status === "ACTIVE") return "open";
  if (s.status === "ACCEPTED") {
    /* قبول بموعد بعيد (>36 ساعة) أو جلسة متابعة مبرمجة = مبرمجة لاحقاً */
    const diff = new Date(s.scheduledAt).getTime() - Date.now();
    if (diff > 36 * HOUR || s.source === "FOLLOW_UP") return "upcoming";
    return "accepted";
  }
  if (s.status === "PENDING") return "pending";
  if (s.status === "COMPLETED") {
    /* جلسة مكتملة بلا متابعة = مكتملة؛ متابعة مبرمجة قادمة تظهر في upcoming */
    return "completed";
  }
  return "cancelled";
}

export function VictimSessionsView() {
  const { t, lang } = useI18n();
  const { user, setView, setActiveSession } = useApp();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<VictimChallenge | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/sessions?userId=${user.id}&role=VICTIM`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /* تحدي الالتزام — يُحسب على الخادم من نبضات الحضور */
  const loadChallenge = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/challenge?victim=1&userId=${user.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (d.ok) setChallenge({ target: d.target, myStreak: d.myStreak, isWinner: d.isWinner, winner: d.winner });
    } catch {
      /* تجاهل */
    }
  }, [user]);

  useEffect(() => {
    load();
    loadChallenge();
    const interval = setInterval(load, 8000); // live status updates
    return () => clearInterval(interval);
  }, [load, loadChallenge]);

  const cancel = async (id: string) => {
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED", cancelledBy: "VICTIM" }),
    });
    load();
  };

  const join = (s: SessionRow) => {
    setActiveSession(s.id);
    setView("session-room");
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-muted-foreground font-semibold">{t.roles.victimDesc}</p>
        <Button className="gradient-primary text-white" onClick={() => setView("victim-start")}>
          {t.roles.victimBtn}
        </Button>
      </div>
    );
  }

  /* التجميع بترتيب طلب المستخدم + الترتيب الزمني داخل كل مجموعة */
  const groups: { key: GroupKey; items: SessionRow[] }[] = (
    ["open", "accepted", "pending", "upcoming", "completed", "cancelled"] as GroupKey[]
  ).map((key) => ({ key, items: [] }));
  for (const s of sessions) {
    const g = groups.find((x) => x.key === groupOf(s));
    g?.items.push(s);
  }
  for (const g of groups) {
    g.items.sort((a, b) =>
      g.key === "cancelled" || g.key === "completed"
        ? new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        : new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }
  const visibleGroups = groups.filter((g) => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-12">
      <BackButton />
      <div className="flex items-center justify-between mb-5 gap-3">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-black"
        >
          {t.victim.mySessionsTitle}
        </motion.h1>
        <Button className="gradient-primary text-white font-bold rounded-xl" onClick={() => setView("victim-topics")}>
          <CalendarPlus className="h-4 w-4" />
          {t.victim.bookNew}
        </Button>
      </div>
      <p className="text-[11px] font-bold text-muted-foreground rounded-xl bg-muted/50 px-3 py-2 mb-5">{t.victim.bookLimitNote}</p>

      {/* ─── v2.9.0: تحدي الالتزام — أول من يحترم 4 مواعيد متتالية (تأخير ≤10 دقائق) ─── */}
      {challenge && (
        <Card className={`mb-5 ${challenge.isWinner ? "border-amber-400/60 bg-gradient-to-b from-amber-400/10 to-transparent" : "border-primary/25 bg-primary/[0.04]"}`}>
          <CardContent className="p-4 flex items-center gap-4">
            {challenge.isWinner ? (
              <RoyalCrown size={40} />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {challenge.winner ? (
                <p className="text-sm font-black" dir="auto">
                  👑 {challenge.winner.name} — {t.challenge.winnerBadge}
                </p>
              ) : (
                <p className="text-sm font-black leading-snug">
                  {t.victim.challengeTitle.replace("{target}", String(challenge.target))}
                </p>
              )}
              {!challenge.winner && (
                <>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {Array.from({ length: challenge.target }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-8 rounded-full ${i < challenge.myStreak ? "bg-primary" : "bg-muted"}`}
                        title={i < challenge.myStreak ? `${i + 1}/${challenge.target}` : ""}
                      />
                    ))}
                    <span className="text-xs font-black font-mono ms-1" dir="ltr">
                      {challenge.myStreak}/{challenge.target}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/50 border-0" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center space-y-4">
            <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-semibold">{t.victim.mySessionsEmpty}</p>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setView("victim-topics")}>
              {t.victim.bookNew}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-7">
          {visibleGroups.map((g) => {
            const style = GROUP_STYLE[g.key];
            const Icon = style.icon;
            const groupTitle =
              g.key === "open"
                ? t.victim.myGroups.open
                : g.key === "accepted"
                  ? t.victim.myGroups.accepted
                  : g.key === "pending"
                    ? t.victim.myGroups.pending
                    : g.key === "upcoming"
                      ? t.victim.myGroups.upcoming
                      : g.key === "completed"
                        ? t.victim.myGroups.completed
                        : t.victim.myGroups.cancelled;
            return (
              <section key={g.key} className="space-y-3">
                {/* رأس المجموعة — تفرقة واضحة بين كل نوع */}
                <div className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 ${style.cls}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-black flex items-center gap-2">
                      {groupTitle}
                      <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-black">{g.items.length}</span>
                    </span>
                    {style.descKey && (
                      <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                        {style.descKey === "groupOpenDesc"
                          ? t.victim.groupOpenDesc
                          : style.descKey === "groupAcceptedDesc"
                            ? t.victim.groupAcceptedDesc
                            : style.descKey === "groupPendingDesc"
                              ? t.victim.groupPendingDesc
                              : t.victim.groupUpcomingDesc}
                      </p>
                    )}
                  </div>
                </div>
                {g.items.map((s, i) => {
                  const ModeIcon = MODE_ICONS[s.mode] || MessageSquareText;
                  const counselorName = s.counselor?.counselorProfile?.fullName || s.counselor?.pseudonym || "—";
                  const isRoomOpen = s.status === "ACTIVE";
                  return (
                    <motion.div key={s.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card className={`border-border/70 ${isRoomOpen ? "border-emerald-500/50 shadow-md shadow-emerald-500/10" : ""}`}>
                        <CardContent className="p-4 sm:p-5 flex flex-wrap items-center gap-3 sm:gap-4">
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <ModeIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-40">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold">{t.victim.topics[s.topic as TopicKey] ?? s.topic}</span>
                              <Badge className={STATUS_COLORS[s.status]}>{s.status}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground font-semibold mt-1">
                              {t.victim.sessionWith} {counselorName} · {formatDateTime(s.scheduledAt)}
                              {s.durationMinutes ? (
                                <span className="ms-2 text-primary font-bold">
                                  ⏱ {t.victim.durationLabel}: {s.durationMinutes} {t.counselor.durationMin}
                                </span>
                              ) : null}
                            </div>
                            {/* v2.8.0: سبب الاعتذار يظهر للمتضرر مباشرة في بطاقة الجلسة الملغاة */}
                            {s.status === "CANCELLED" && s.cancelReason && s.cancelledBy === "COUNSELOR" && (
                              <div className="text-[11px] font-bold text-destructive mt-1 rounded-xl bg-destructive/5 px-3 py-1.5" dir="auto">
                                {t.victim.declinedReason}: {s.cancelReason}
                              </div>
                            )}
                            {s.status === "COMPLETED" && s.followUpAt && !s.treatmentEnded && (
                              <div className="text-[11px] font-bold text-primary mt-1 flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" />
                                {t.session.nextSessionNote}
                                {formatDateTime(s.followUpAt)}
                              </div>
                            )}
                            {s.status === "COMPLETED" && s.treatmentEnded && (
                              <div className="text-[11px] font-bold text-muted-foreground mt-1">🌿 {t.session.treatmentEndedNote}</div>
                            )}
                          </div>
                          <div className="flex gap-2 ms-auto">
                            {(s.status === "ACCEPTED" || s.status === "ACTIVE") && (
                              <Button
                                size="sm"
                                className={`font-bold rounded-lg ${isRoomOpen ? "gradient-primary text-white animate-pulse" : "gradient-primary text-white"}`}
                                onClick={() => join(s)}
                              >
                                <LogIn className="h-4 w-4" />
                                {isRoomOpen ? t.counselor.joinRoom : t.counselor.joinRoom}
                              </Button>
                            )}
                            {s.status === "PENDING" && (
                              <Button size="sm" variant="outline" className="rounded-lg text-destructive border-destructive/40" onClick={() => cancel(s.id)}>
                                <XCircle className="h-4 w-4" />
                                {t.victim.cancelSession}
                              </Button>
                            )}
                            {(s.status === "COMPLETED" || s.status === "CANCELLED") && (
                              <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setView("victim-topics")}>
                                {t.victim.rebook}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
