"use client";

/**
 * v2.8.0 — محادثة ما قبل الجلسة (DM) بين المتضرر والأخصائي.
 * ─────────────────────────────────────────────────────────────
 * زر «تواصل» يتيح للمتضرر مراسلة الأخصائي حتى قبل طلب جلسة،
 * وللأخصائي مراسلة المتضرر قبل قبول طلبه.
 *
 * تُفتح النافذة عبر حدث عام من أي صفحة:
 *   window.dispatchEvent(new CustomEvent("open-dm", {
 *     detail: { peerId, peerName }   // معرّف الطرف الآخر واسمه
 *   }))
 *
 * الخيط مشترك ثابت: dm:{victimId}:{counselorId} — الرسائل تُخزَّن في
 * مجموعة messages بلا sessionId، ويصل إشعار للطرف الغائب فقط
 * (آخر نبض عام له أقدم من نافذة الحضور) مع اقتباس من الرسالة.
 * تُركَّب مرة واحدة في page.tsx فتعمل من كل صفحات المنصة.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DmMessage {
  id: string;
  senderRole: string;
  senderName: string | null;
  content: string;
  createdAt: string;
}

export function DmDialog() {
  const { t, lang } = useI18n();
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [peer, setPeer] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);

  /* threadKey ثابت: المتضرر دائماً أول معرّف */
  const threadKey =
    user && peer
      ? user.role === "VICTIM"
        ? `dm:${user.id}:${peer.id}`
        : `dm:${peer.id}:${user.id}`
      : null;

  const myRole = user?.role === "COUNSELOR" ? "COUNSELOR" : "VICTIM";
  const myName = user?.role === "COUNSELOR" ? user.fullName || "" : user?.pseudonym || "";

  const load = useCallback(async () => {
    if (!threadKey) return;
    try {
      const qs = lastAtRef.current ? `&since=${encodeURIComponent(lastAtRef.current)}` : "";
      const res = await fetch(`/api/messages?threadKey=${encodeURIComponent(threadKey)}${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      const incoming: DmMessage[] = data.messages || [];
      if (incoming.length > 0) {
        lastAtRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((cur) => {
          const seen = new Set(cur.map((m) => m.id));
          return [...cur, ...incoming.filter((m) => !seen.has(m.id))];
        });
      }
    } catch {
      /* أخطاء الشبكة المؤقتة — الاستقصاء القادم يعيد المحاولة */
    }
  }, [threadKey]);

  /* فتح عبر الحدث العام + إعادة ضبط الخيط */
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; name: string };
      if (!d?.id) return;
      setPeer({ id: d.id, name: d.name || "—" });
      setMessages([]);
      lastAtRef.current = null;
      setErr("");
      setOpen(true);
    };
    window.addEventListener("open-dm", handler);
    return () => window.removeEventListener("open-dm", handler);
  }, []);

  /* استقصاء كل 4 ثوانٍ + بث فوري عبر جسر socket.io عندما يكون نشطاً */
  useEffect(() => {
    if (!open || !threadKey) return;
    load();
    const i = setInterval(load, 4000);
    const bridge = (globalThis as { __rafiqiDmSub?: boolean }).__rafiqiDmSub;
    void bridge;
    return () => clearInterval(i);
  }, [open, threadKey, load]);

  /* بث socket.io الحي: رسائل dm_message تصل فوراً (الخادم الموحّد فقط) */
  useEffect(() => {
    if (!open || !threadKey) return;
    let socket: { on: (e: string, cb: (p: unknown) => void) => void; off: (e: string, cb: (p: unknown) => void) => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { io } = await import("socket.io-client");
        if (cancelled) return;
        const s = io({ path: "/socket.io", transports: ["websocket", "polling"] });
        socket = s as unknown as typeof socket;
        s.on("dm_message", (p: unknown) => {
          const msg = p as DmMessage;
          if (!msg?.id) return;
          setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
          lastAtRef.current = msg.createdAt;
        });
      } catch {
        /* الاستقصاء يغطي الحالة — البث ميزة إضافية */
      }
    })();
    return () => {
      cancelled = true;
      if (socket) {
        socket.off("dm_message", () => {});
        (socket as unknown as { disconnect?: () => void }).disconnect?.();
      }
    };
  }, [open, threadKey]);

  /* تمرير تلقائي لآخر رسالة */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || !threadKey || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadKey, senderRole: myRole, senderId: user?.id, senderName: myName, content }),
      });
      const data = await res.json();
      if (data.ok && data.message) {
        const msg = data.message as DmMessage;
        setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
        lastAtRef.current = msg.createdAt;
        setText("");
      } else if (data.error === "NOT_ALLOWED") {
        setErr(t.dm.notAllowed);
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
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border bg-muted/40">
          <DialogTitle className="text-start flex items-center gap-2 text-base">
            <MessageCircle className="h-4.5 w-4.5 text-primary shrink-0" />
            <span className="truncate">{t.dm.title}</span>
            <span className="text-primary truncate max-w-40">{peer?.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div ref={listRef} className="h-[45vh] min-h-56 overflow-y-auto scrollbar-thin px-4 py-3 space-y-2 bg-background">
          {messages.length === 0 ? (
            <p className="text-center text-xs font-semibold text-muted-foreground py-10">{t.dm.empty}</p>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === myRole;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      mine ? "gradient-primary text-white rounded-ee-sm" : "bg-muted text-foreground rounded-es-sm"
                    }`}
                    dir="auto"
                  >
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

        {err && <p className="px-5 pb-2 text-[11px] font-bold text-destructive">{err}</p>}

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/30">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={t.dm.placeholder}
            className="rounded-xl bg-card"
            dir="auto"
            maxLength={4000}
          />
          <Button size="icon" className="gradient-primary text-white rounded-xl shrink-0 h-10 w-10" disabled={busy || !text.trim()} onClick={() => void send()} aria-label={t.dm.send}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <button
          onClick={() => setOpen(false)}
          className="w-full py-2 text-center text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors border-t border-border flex items-center justify-center gap-1"
        >
          <X className="h-3 w-3" />
          {t.common.close}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** أداة صغيرة لفتح المحادثة من أي مكان — زر «تواصل» */
export function openDm(peerId: string, peerName: string) {
  window.dispatchEvent(new CustomEvent("open-dm", { detail: { id: peerId, name: peerName } }));
}
