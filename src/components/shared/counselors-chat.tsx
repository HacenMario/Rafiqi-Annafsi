"use client";

/**
 * v2.9.0 — فضاء الأخصائيين: دردشة جماعية خاصة بالمختصين فقط.
 * ─────────────────────────────────────────────────────────────
 * خيط ثابت threadKey = "counselors" في نفس مجموعة messages،
 * الإرسال للأخصائيين حصراً (يتحقق الخادم)، والبث الفوري عبر جسر
 * socket.io عند توفره + استقصاء REST كشبكة أمان.
 * تُركَّب داخل لوحة الأخصائي (نافذة أو بطاقة موسّعة).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Send, UsersRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface GroupMessage {
  id: string;
  senderRole: string;
  senderName: string | null;
  content: string;
  createdAt: string;
}

export function CounselorsChat() {
  const { t, lang } = useI18n();
  const { user } = useApp();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = lastAtRef.current ? `&since=${encodeURIComponent(lastAtRef.current)}` : "";
      const res = await fetch(`/api/messages?threadKey=counselors${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const incoming: GroupMessage[] = data.messages || [];
      if (incoming.length > 0) {
        lastAtRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((cur) => {
          const seen = new Set(cur.map((m) => m.id));
          return [...cur, ...incoming.filter((m) => !seen.has(m.id))];
        });
      }
    } catch {
      /* الاستقصاء القادم يعيد المحاولة */
    }
  }, []);

  useEffect(() => {
    lastAtRef.current = null;
    setMessages([]);
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, [load]);

  /* تمرير تلقائي لآخر رسالة */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || busy || user?.role !== "COUNSELOR") return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadKey: "counselors",
          senderRole: "COUNSELOR",
          senderId: user.id,
          senderName: user.fullName || "",
          content,
        }),
      });
      const data = await res.json();
      if (data.ok && data.message) {
        const msg = data.message as GroupMessage;
        setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
        lastAtRef.current = msg.createdAt;
        setText("");
      } else {
        setErr(t.common.error);
      }
    } catch {
      setErr(t.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[55vh] min-h-72">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 py-3 space-y-2 bg-background rounded-t-xl border border-border">
        {messages.length === 0 ? (
          <p className="text-center text-xs font-semibold text-muted-foreground py-10">{t.counselor.groupChatEmpty}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderName && user?.fullName && m.senderName === user.fullName;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
                    mine ? "gradient-primary text-white rounded-ee-sm" : "bg-muted text-foreground rounded-es-sm"
                  }`}
                  dir="auto"
                >
                  {!mine && m.senderName && (
                    <div className="text-[10px] font-black text-primary mb-0.5" dir="auto">
                      {m.senderName}
                    </div>
                  )}
                  {m.content}
                  <div className={`text-[9px] font-bold mt-1 ${mine ? "text-white/70" : "text-muted-foreground"}`} dir="ltr">
                    {new Date(m.createdAt).toLocaleTimeString(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {err && <p className="px-3 py-1 text-[11px] font-bold text-destructive">{err}</p>}
      <div className="flex items-center gap-2 p-3 border border-t-0 border-border rounded-b-xl bg-muted/30">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t.counselor.groupChatPlaceholder}
          className="rounded-xl bg-card"
          dir="auto"
          maxLength={2000}
        />
        <Button size="icon" className="gradient-primary text-white rounded-xl shrink-0 h-10 w-10" disabled={busy || !text.trim()} onClick={() => void send()} aria-label={t.dm.send}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** بطاقة فضاء الأخصائيين داخل اللوحة — مفتوحة/مطوية */
export function CounselorsChatCard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-primary/25 bg-primary/[0.04]">
      <CardContent className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 text-start"
        >
          <span className="font-bold text-sm flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-primary" />
            <span className="min-w-0">
              {t.counselor.groupChatTitle}
              <span className="block text-[11px] font-semibold text-muted-foreground">{t.counselor.groupChatDesc}</span>
            </span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {!open && <span className="text-[11px] font-black text-primary">{t.counselor.groupChatOpen}</span>}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          </span>
        </button>
        {open && <CounselorsChat />}
      </CardContent>
    </Card>
  );
}
