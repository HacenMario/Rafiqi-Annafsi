import "server-only";
import { InAppNotification, PushSubscription, SupportSession, User } from "@/lib/models";
import { sendPushToUser } from "@/lib/server/push";

/**
 * التذكير المسبق بالموعد بساعة (إشعار داخل المنصة + إشعار فوري على الهاتف).
 * نفس منطق مجدول server.js — يُستدعى هنا بشكل كسول (fire-and-forget) من
 * GET /api/sessions ليعمل أيضاً على Vercel حيث لا يوجد مجدول دائم.
 * idempotent: الحجز الذري عبر reminderSentAt يمنع التكرار بين المنصتين.
 */
const REMINDER_TEXTS: Record<"ar" | "fr" | "en", { title: string; body: string }> = {
  ar: { title: "⏰ تذكير: جلستك بعد ساعة", body: "جلستك في «رفيقي النفسي» بعد ساعة تقريباً — الغرفة تنتظركما" },
  fr: { title: "⏰ Rappel : votre séance dans une heure", body: "Votre séance sur Rafiqi Annafsi commence dans une heure — la salle vous attend" },
  en: { title: "⏰ Reminder: your session in one hour", body: "Your Rafiqi Annafsi session starts in about an hour — the room is waiting for you" },
};

export async function sendDueReminders(): Promise<void> {
  try {
    const now = Date.now();
    const due = await (SupportSession.find({
      status: { $in: ["PENDING", "ACCEPTED"] },
      scheduledAt: { $gte: new Date(now + 55 * 60 * 1000), $lte: new Date(now + 65 * 60 * 1000) },
      reminderSentAt: null,
    })
      .select("_id victimId counselorId")
      .limit(20)
      .lean()) as unknown as { _id: unknown; victimId: unknown; counselorId: unknown }[];

    for (const s of due) {
      const claim = await SupportSession.updateOne(
        { _id: s._id, reminderSentAt: null },
        { $set: { reminderSentAt: new Date() } }
      );
      if (!claim.modifiedCount) continue;

      for (const userId of [String(s.victimId), String(s.counselorId)]) {
        try {
          const u = (await User.findById(userId).select("language").lean()) as { language?: string } | null;
          const lang = (u?.language === "fr" || u?.language === "en" ? u.language : "ar") as "ar" | "fr" | "en";
          const txt = REMINDER_TEXTS[lang];
          await InAppNotification.create({ userId, key: "reminder", title: txt.title, body: txt.body, url: "/" }).catch(() => {});
          await sendPushToUser(userId, txt.title, txt.body, "/");
        } catch {
          /* فشل إشعار طرف واحد لا يعطل البقية */
        }
      }
    }
  } catch {
    /* التذكيرات خدمة إضافية — لا تُفشل طلب الواجهة أبداً */
  }
}
