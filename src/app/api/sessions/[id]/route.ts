import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Message, SupportSession } from "@/lib/models";
import { attachParticipants } from "@/lib/server/sessions";
import { notifyUser, formatWhenUTC1 } from "@/lib/server/notify";
import { apiHandler } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/* تذكيرات المواعيد القادمة — كسول (fire-and-forget) ليعمل أيضاً على Vercel */
function triggerReminders() {
  import("@/lib/server/reminders")
    .then((m) => m.sendDueReminders())
    .catch(() => {});
}

async function GET_impl(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  /* v2.7.0: هوية الطالب — تُستعمل حصراً لكشف رقم هاتف المتضرر لأخصائي
     جلسته هو (أي استعلام آخر لا يرى الرقم إطلاقاً) */
  const viewerId = searchParams.get("userId");
  await connectDB();
  triggerReminders();

  const session = await SupportSession.findById(id).lean();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [attached] = await attachParticipants([session], viewerId);
  const messages = await Message.find({ sessionId: id })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  return NextResponse.json({
    session: {
      ...attached,
      messages: messages.map((m) => ({
        id: String(m._id),
        sessionId: String(m.sessionId),
        senderRole: m.senderRole,
        senderName: m.senderName,
        content: m.content,
        createdAt: m.createdAt,
      })),
    },
  });
}

async function PATCH_impl(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, mode, moodBefore, moodAfter, notes, crisisFlag, followUpAt, treatmentEnded } = body;
  /* v2.8.0: القبول بمدة محددة + الرفض بسبب إلزامي + تغيير الموعد قبل القبول */
  const durationMinutes = body.durationMinutes;
  const cancelReason = typeof body.cancelReason === "string" ? body.cancelReason.trim() : "";
  const cancelledBy = typeof body.cancelledBy === "string" ? body.cancelledBy : null;
  const rescheduleTo = body.rescheduleTo;
  /* v2.7.0: هوية الطالب لكشف رقم هاتف المتضرر لأخصائي الجلسة في الاستجابة */
  const viewerId = typeof body?.viewerId === "string" ? body.viewerId : null;

  await connectDB();

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "ACTIVE") data.startedAt = new Date();
    if (status === "COMPLETED") data.endedAt = new Date();
  }
  if (mode) data.mode = mode;
  /* v2.8.0: مدة الجلسة (30–240 دقيقة) تُحفظ عند القبول ليراها المتضرر —
     الجلسة لا تُغلق تلقائياً بعد انقضاء المدة، الإنهاء قرار الأخصائي دائماً */
  if (durationMinutes !== undefined && durationMinutes !== null) {
    const dm = Number(durationMinutes);
    if (!Number.isFinite(dm) || dm < 15 || dm > 240) {
      return NextResponse.json({ error: "INVALID_DURATION" }, { status: 400 });
    }
    data.durationMinutes = Math.round(dm);
  }
  /* v2.8.0: سبب التعذّر إلزامي عند اعتذار الأخصائي عن الطلب */
  if (cancelReason) data.cancelReason = cancelReason.slice(0, 500);
  if (cancelledBy) data.cancelledBy = cancelledBy;
  if (status === "CANCELLED" && cancelledBy === "COUNSELOR" && !data.cancelReason) {
    return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
  }
  if (moodBefore !== undefined) data.moodBefore = moodBefore;
  if (moodAfter !== undefined) data.moodAfter = moodAfter;
  if (notes !== undefined) data.notes = notes;
  if (crisisFlag !== undefined) data.crisisFlag = crisisFlag;

  /* v2.8.0: تغيير موعد الطلب قبل قبوله — للأخصائي فقط، مع إشعار خاص للمتضرر
     بالموعد الجديد. لا يعمل على جلسة مقبولة/جارية/منتهية */
  let rescheduled = false;
  if (rescheduleTo) {
    const current = (await SupportSession.findById(id).select("status scheduledAt victimId counselorId").lean()) as {
      status?: string;
      victimId: unknown;
      counselorId: unknown;
    } | null;
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.status !== "PENDING") {
      return NextResponse.json({ error: "NOT_PENDING" }, { status: 400 });
    }
    const nd = new Date(rescheduleTo);
    if (Number.isNaN(nd.getTime()) || nd.getTime() < Date.now() - 2 * 60 * 1000) {
      return NextResponse.json({ error: "PAST_DATE" }, { status: 400 });
    }
    /* لا تصادم مع جلسة أخرى لنفس الأخصائي في نفس الموعد الجديد */
    const clash = await SupportSession.findOne({
      _id: { $ne: id },
      counselorId: current.counselorId,
      status: { $in: ["PENDING", "ACCEPTED", "ACTIVE"] },
      scheduledAt: { $gte: new Date(nd.getTime() - 30 * 60 * 1000), $lte: new Date(nd.getTime() + 30 * 60 * 1000) },
    })
      .select("_id")
      .lean();
    if (clash) return NextResponse.json({ error: "SLOT_TAKEN" }, { status: 409 });

    data.scheduledAt = nd;
    const prevCount = ((await SupportSession.findById(id).select("rescheduleCount").lean()) as unknown as { rescheduleCount?: number } | null)?.rescheduleCount || 0;
    data.rescheduleCount = prevCount + 1;
    data.lastRescheduledAt = new Date();
    rescheduled = true;
  }

  /* خطة ما بعد الجلسة — قرار الأخصائي حسب حالة المتضرر
     (تحقق خادم صارم: لا تُقبل جلسة متابعة بموعد فائت) */
  let followUpCreated: string | null = null;
  if (followUpAt) {
    const d = new Date(followUpAt);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      return NextResponse.json({ error: "PAST_DATE" }, { status: 400 });
    }
    data.followUpAt = d;
    data.status = "COMPLETED";
    data.endedAt = data.endedAt || new Date();
  }
  if (treatmentEnded) {
    data.treatmentEnded = true;
    data.status = "COMPLETED";
    data.endedAt = data.endedAt || new Date();
  }

  const updated = (await SupportSession.findByIdAndUpdate(id, { $set: data }, { new: true }).lean()) as
    | ({ _id: unknown; victimId: unknown; counselorId: unknown } & Record<string, unknown>)
    | null;
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* جدولة الجلسة التالية: تُنشأ الجلسة تلقائياً بتفاصيلها (نفس الطرفين ونفس الموضوع
     والنمط) بحالة «مقبولة» — لا حاجة لإنشاء جلسة يدوياً في كل مرة؛ يكفي أن
     يدخل الطرفان الغرفة في الموعد المحدد، ويصلهما تذكير قبل ساعة من الموعد */
  if (data.followUpAt && !data.treatmentEnded) {
    try {
      const created = await SupportSession.create({
        victimId: updated.victimId,
        counselorId: updated.counselorId,
        topic: updated.topic,
        mode: updated.mode || "TEXT",
        scheduledAt: data.followUpAt,
        status: "ACCEPTED",
        source: "FOLLOW_UP",
      });
      followUpCreated = String(created._id);
    } catch (e) {
      console.error("[SESSION] تعذر إنشاء جلسة المتابعة تلقائياً:", (e as Error).message);
    }
  }

  // إشعارات محلّية عند انتقالات الحالة
  if (status === "ACCEPTED") {
    notifyUser(String(updated.victimId), "accepted", "/").catch(() => {});
  }
  /* اعتذار الأخصائي عن الطلب → إشعار تلقائي للمتضرر مع سبب التعذّر (v2.8.0).
     إلغاء المتضرر نفسه لطلبه لا يحتاج إشعاراً — هو من ألغاه */
  if (status === "CANCELLED") {
    if (data.cancelledBy === "COUNSELOR" && data.cancelReason) {
      notifyUser(String(updated.victimId), "declinedReason", "/", { reason: String(data.cancelReason) }).catch(() => {});
    } else if (data.cancelledBy !== "VICTIM") {
      notifyUser(String(updated.victimId), "declined", "/").catch(() => {});
    }
  }
  /* v2.8.0: تغيير الموعد قبل القبول → إشعار خاص للمتضرر بالموعد الجديد */
  if (rescheduled && data.scheduledAt) {
    notifyUser(String(updated.victimId), "rescheduled", "/", {
      when: formatWhenUTC1(data.scheduledAt as Date),
    }).catch(() => {});
  }
  if (status === "ACTIVE") {
    /* إشعار بدء الجلسة للمتضرر فقط — الأخصائي هو من بدأها فلا يحتاج تنبيهاً
       (احترام صارم لحقل role: لا إشعارات متضرر تصل للأخصائي أو العكس) */
    notifyUser(String(updated.victimId), "started", "/").catch(() => {});
  }
  if (data.followUpAt) {
    notifyUser(String(updated.victimId), "followUp", "/").catch(() => {});
  }
  if (data.treatmentEnded) {
    notifyUser(String(updated.victimId), "treatmentEnded", "/").catch(() => {});
  }

  const [attached] = await attachParticipants([updated], viewerId);
  return NextResponse.json({ ok: true, session: attached, followUpCreated });
}

export const GET = apiHandler(GET_impl);
export const PATCH = apiHandler(PATCH_impl);
