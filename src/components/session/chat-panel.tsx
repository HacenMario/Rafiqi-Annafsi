"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { SendHorizonal, Eraser } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { playSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import CRISIS_KEYWORDS from "../../../shared/crisis-keywords.json";

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderRole: "VICTIM" | "COUNSELOR" | "SYSTEM";
  senderName?: string;
  content: string;
  createdAt: string;
}

interface ChatPanelProps {
  sessionId: string;
  myRole: "VICTIM" | "COUNSELOR";
  myName: string;
  active: boolean;
  /* saidBy: دور كاتب العبارة الخطرة — يُسجّل في سجل الأزمات (للأدمين) */
  onCrisis: (phrase: string, saidBy?: string | null) => void;
  onPartnerPresence: (present: boolean, name?: string) => void;
}

/* فاصل استقصاء REST عند غياب Socket.io (مثل Vercel serverless) */
const POLL_INTERVAL_MS = 4000;

/* كشف عبور الخط الأحمر محلياً (يستخدم في وضع الاستقصاء حيث لا يوجد بث فوري) */
function detectCrisisLocal(content: string): string | null {
  const lower = String(content).toLowerCase();
  for (const kw of CRISIS_KEYWORDS as string[]) {
    if (lower.includes(String(kw).toLowerCase())) return kw;
  }
  return null;
}

export function ChatPanel({ sessionId, myRole, myName, active, onCrisis, onPartnerPresence }: ChatPanelProps) {
  const { t, lang } = useI18n();
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string>("");
  const sendingRef = useRef(false);
  const onCrisisRef = useRef(onCrisis);
  onCrisisRef.current = onCrisis;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [realtime, setRealtime] = useState(false);   /* Socket.io متصل */
  const [reachable, setReachable] = useState(false); /* REST API يستجيب */
  const [partnerTyping, setPartnerTyping] = useState(false);
  /* المسح محلي فقط: الرسائل تبقى محفوظة في الخادم للطرف الآخر */
  const clearKey = `rafiqi-chat-cleared-${sessionId}`;
  const [clearedAt, setClearedAt] = useState<string | null>(null);

  useEffect(() => {
    setClearedAt(localStorage.getItem(clearKey));
  }, [clearKey]);

  const clearLocal = () => {
    const now = new Date().toISOString();
    localStorage.setItem(clearKey, now);
    setClearedAt(now);
  };

  const visibleMessages = clearedAt
    ? messages.filter((m) => new Date(m.createdAt) > new Date(clearedAt))
    : messages;

  /* دمج رسائل واردة (من البث أو الاستقصاء) مع إزالة التكرار واستبدال المؤقتة */
  const mergeIncoming = useCallback(
    (incoming: ChatMessage[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        let next = prev;
        let changed = false;
        for (const m of incoming) {
          if (known.has(m.id)) continue;
          const arr = [...next];
          /* استبدال الرسالة المؤقتة المماثلة (الإرسال التفاؤلي) بالنسخة الحقيقية */
          const tmpIdx = arr.findIndex(
            (x) => x.id.startsWith("tmp-") && x.senderRole === m.senderRole && x.content === m.content
          );
          if (tmpIdx >= 0) arr[tmpIdx] = m;
          else arr.push(m);
          known.add(m.id);
          next = arr;
          changed = true;
          if (m.senderRole !== myRole) {
            playSound("message");
            /* في وضع الاستقصاء لا يوجد حدث crisis_alert — نكتشف العبارة محلياً
               ونعرف كاتبها: صاحب الرسالة الواردة (الطرف الآخر) */
            const phrase = detectCrisisLocal(m.content);
            if (phrase) setTimeout(() => onCrisisRef.current(phrase, m.senderRole), 0);
          }
        }
        if (!changed) return prev;
        next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return next;
      });
      const lastIncoming = incoming[incoming.length - 1];
      if (!lastAtRef.current || new Date(lastIncoming.createdAt) > new Date(lastAtRef.current)) {
        lastAtRef.current = lastIncoming.createdAt;
      }
    },
    [myRole]
  );

  /* ─── سجل المحادثة عبر REST (يعمل على كل المنصات) ─── */
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages?sessionId=${sessionId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        const msgs: ChatMessage[] = d.messages || [];
        setMessages(msgs);
        if (msgs.length) lastAtRef.current = msgs[msgs.length - 1].createdAt;
        setReachable(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /* ─── وضع الاستقصاء: شبكة أمان عندما لا يتوفر Socket.io ───
     على Vercel (serverless) لا يمكن إبقاء WebSocket حيّاً، فنسحب
     الرسائل الجديدة كل بضع ثوانٍ عبر GET /api/messages?since=… */
  useEffect(() => {
    if (realtime) return; /* البث الفوري يعمل — لا حاجة للاستقصاء */
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const since = lastAtRef.current ? `&since=${encodeURIComponent(lastAtRef.current)}` : "";
        const r = await fetch(`/api/messages?sessionId=${sessionId}${since}`, { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          mergeIncoming(d.messages || []);
          setReachable(true);
        }
      } catch {
        /* الشبكة متقطعة — نعيد المحاولة في الدورة التالية */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => clearInterval(timer);
  }, [sessionId, realtime, mergeIncoming]);

  /* ─── Socket.io: بث فوري "أفضل جهد" ───
     يعمل مباشرة على Railway (الخادم الموحّد server.js)، وعلى أي منصة
     يُوجَّه إليها العميل عبر NEXT_PUBLIC_SOCKET_URL. عند تعذر الاتصال
     (مثل Vercel) تتولى دورة الاستقصاء أعلاه استلام الرسائل تلقائياً. */
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
    const s = io(url, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 4, /* محدودة كي لا تُغرق الكونسول بأخطاء على Vercel */
      reconnectionDelay: 1500,
      timeout: 10000,
    });
    socketRef.current = s;

    s.on("connect", () => {
      setRealtime(true);
      s.emit("join_session", { sessionId, role: myRole, name: myName });
    });

    s.on("disconnect", () => setRealtime(false));
    s.on("reconnect_failed", () => setRealtime(false));
    s.io.on("reconnect_failed", () => setRealtime(false));

    s.on("text_message", (msg: ChatMessage) => {
      mergeIncoming([msg]);
    });

    s.on("typing", (data: { role: string; typing: boolean }) => {
      if (data.role !== myRole) setPartnerTyping(data.typing);
    });

    s.on("crisis_alert", (data: { phrase: string }) => {
      onCrisisRef.current(data.phrase);
    });

    s.on("presence", (data: { members: { role: string; name: string }[]; joined?: { role: string }; left?: { role: string } }) => {
      const partner = data.members?.filter((m) => m.role !== myRole) || [];
      onPartnerPresence(partner.length > 0, partner[0]?.name);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setRealtime(false);
      setPartnerTyping(false);
    };
  }, [sessionId, myRole, myName, mergeIncoming]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, partnerTyping]);

  /* ─── الإرسال عبر REST دائماً — مضمون على Railway وVercel معاً ───
     على الخادم الموحّد (Railway) تنشر واجهة REST الرسالة فوراً لغرفة
     Socket.io عبر جسر نفس العملية، فيصلها الطرف الآخر لحظياً. */
  const send = async () => {
    const content = input.trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setInput("");
    socketRef.current?.emit("typing", { sessionId, role: myRole, typing: false });

    /* عرض فوري تفاؤلي ثم استبداله بالنسخة المحفوظة من الخادم */
    const temp: ChatMessage = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      senderRole: myRole,
      senderName: myName,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);

    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, senderRole: myRole, senderName: myName, content }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok || !d.message) throw new Error(d.error || "send failed");
      mergeIncoming([d.message]);
      if (d.crisis) onCrisisRef.current(d.crisis, myRole);
    } catch {
      /* فشل الإرسال: أزل المؤقتة وأعد النص للحفظ */
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setInput(content);
    } finally {
      sendingRef.current = false;
    }
  };

  const onInput = (value: string) => {
    setInput(value);
    socketRef.current?.emit("typing", { sessionId, role: myRole, typing: value.length > 0 });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block text-[11px] text-muted-foreground bg-muted rounded-full px-3 py-1 font-semibold">
            {t.session.chatEmpty}
          </span>
          {messages.length > 0 && (
            <button
              onClick={clearLocal}
              title={t.session.chatClear}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <Eraser className="h-3.5 w-3.5" />
              {t.session.chatClear}
            </button>
          )}
        </div>
        {visibleMessages.map((m) => {
          if (m.senderRole === "SYSTEM") {
            return (
              <div key={m.id} className="text-center">
                <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-3 py-1 font-semibold">
                  {m.content}
                </span>
              </div>
            );
          }
          const mine = m.senderRole === myRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                  mine
                    ? "gradient-primary text-white rounded-ee-sm"
                    : "bg-card border border-border rounded-es-sm"
                } ${m.id.startsWith("tmp-") ? "opacity-70" : ""}`}
                dir="auto"
              >
                {m.content}
              </div>
            </div>
          );
        })}
        {partnerTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-es-sm px-4 py-2.5 flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
              <span className="text-[11px] text-muted-foreground font-semibold ms-1">{t.session.chatTyping}</span>
            </div>
          </div>
        )}
      </div>

      {/* Input — منطقة كتابة مريحة متعددة الأسطر:
          Enter يرسل، Shift+Enter سطر جديد، وتنمو تلقائياً حتى 5 أسطر */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t.session.chatPlaceholder}
            disabled={!active}
            rows={1}
            className="rounded-xl bg-card min-h-11 max-h-32 resize-none py-2.5 leading-relaxed"
            dir="auto"
            aria-label={t.session.chatPlaceholder}
          />
          <Button
            size="icon"
            className="gradient-primary text-white rounded-xl shrink-0 h-11 w-11"
            onClick={send}
            disabled={!active || !input.trim()}
            aria-label={t.common.send}
          >
            <SendHorizonal className={`h-4 w-4 ${lang === "ar" ? "-scale-x-100" : ""}`} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 font-semibold mt-1.5 px-1">
          {t.session.chatSendHint}
        </p>
      </div>

      {/* connection indicator */}
      <div className="px-3 pb-2">
        {!reachable ? (
          <span className="text-[10px] text-amber-600 font-semibold">{t.session.connecting}</span>
        ) : !realtime ? (
          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">{t.session.syncMode}</span>
        ) : null}
      </div>
    </div>
  );
}
