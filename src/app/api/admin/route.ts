import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CounselorProfile, CrisisLog, Feedback, FoundersContent, InAppNotification, Message, PushSubscription, SupportSession, User } from "@/lib/models";
import { notifyBulk, messageExcerpt } from "@/lib/server/notify";
import { listEnrichedCrisisLogs } from "@/lib/server/crisis";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { hashSecret } from "@/lib/server/auth";
import { apiHandler } from "@/lib/server/api";
import { sweepOverdueRequests, listOverdueRequests } from "@/lib/server/overdue";
import { challengeStatus } from "@/lib/server/challenge";
import { getVictimChallengeWinner } from "@/lib/server/victim-challenge";
import { notifyVictimVerification } from "@/lib/server/notify";
import { dayKeyUTC1 } from "@/lib/availability";

export const dynamic = "force-dynamic";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function POST_impl(req: NextRequest) {
  const body = await req.json();
  const action = body.action;
  await connectDB();

  if (action === "login") {
    /* لا كلمة مرور افتراضية — يجب ضبط ADMIN_PASSCODE في متغيرات البيئة */
    const envPasscode = process.env.ADMIN_PASSCODE;
    if (!envPasscode) {
      return NextResponse.json(
        { error: "ADMIN_PASSCODE_MISSING", message: "اضبط متغير البيئة ADMIN_PASSCODE أولاً" },
        { status: 503 }
      );
    }
    if (body.passcode !== envPasscode) {
      return NextResponse.json({ error: "INVALID" }, { status: 401 });
    }
    /* v2.7.0: حساب أدمين حقيقي في القاعدة — يضمن وصول إشعار فائز التحدي
       (وكل إشعارات الإدارة الداخلية) إلى معرّف ObjectId صحيح،
       ويعمل جرس الإشعارات في حساب الأدمين. إن لم يوجد مستند سابقاً
       (تثبيت قديم يعمل برمز البيئة وحده) يُنشأ مرة واحدة تلقائياً */
    let admin = (await User.findOne({ role: "ADMIN" }).lean()) as { _id?: unknown } | null;
    if (!admin) {
      try {
        admin = (await User.create({ role: "ADMIN", pseudonym: "الإدارة", language: "ar" }).then((d: any) => d.toObject())) as { _id?: unknown };
      } catch {
        /* قاعدة مقيدة؟ نعود للمعرّف الاصطناعي القديم */
      }
    }
    return NextResponse.json({
      ok: true,
      user: { id: admin ? String(admin._id) : "admin", role: "ADMIN" },
    });
  }

  /* ─── إدارة الحسابات: قائمة كل المستخدمين مع بحث وفلترة ─── */
  if (action === "list-users") {
    const filter: Record<string, unknown> = {};
    if (body.role && body.role !== "ALL") filter.role = body.role;
    if (body.q && String(body.q).trim()) {
      const rx = new RegExp(escapeRegExp(String(body.q).trim()), "i");
      filter.$or = [{ pseudonym: rx }, { email: rx }];
    }
    /* v2.8.0 أداء: استبعاد الصور base64 الضخمة من استعلام القائمة —
       كانت سبب بطء قائمة الحسابات وطلبات التوثيق */
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const ids = users.map((u) => u._id);
    const profiles = await CounselorProfile.find({ userId: { $in: ids } })
      .select("userId fullName whatsapp verificationStatus yearsExperience")
      .lean();
    const byUser = new Map(profiles.map((p) => [String(p.userId), p]));
    return NextResponse.json({
      users: users.map((u) => {
        const p = byUser.get(String(u._id));
        return {
          id: String(u._id),
          role: u.role,
          pseudonym: u.pseudonym ?? null,
          email: u.email ?? null,
          wilaya: u.wilaya ?? null,
          language: u.language ?? null,
          createdAt: u.createdAt,
          fullName: p?.fullName ?? null,
          whatsapp: p?.whatsapp ?? null,
          verificationStatus: p?.verificationStatus ?? null,
          /* v2.9.0: الجنس + حالة توثيق التضرر من الحرائق (قابلية الفرز والمراجعة) */
          gender: (u as { gender?: string | null }).gender ?? null,
          fireStatus: (u as { fireCase?: { declared?: boolean; status?: string } }).fireCase?.declared
            ? (u as { fireCase?: { status?: string } }).fireCase?.status ?? "PENDING"
            : null,
          /* v2.6.0: حالة التعليق + عدّاد التأخر في قبول الطلبات */
          suspended: !!(u as unknown as { suspended?: boolean }).suspended,
          lateCount: Number(p?.lateCount) || 0,
        };
      }),
    });
  }

  /* ─── حذف حساب نهائياً مع كل بياناته (جلسات، رسائل، اشتراكات، ملف مهني) ─── */
  if (action === "delete-user") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const user = await User.findById(userId).lean();
    if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const sessions = await SupportSession.find({
      $or: [{ victimId: userId }, { counselorId: userId }],
    })
      .select("_id")
      .lean();
    const sessionIds = sessions.map((s) => s._id);

    await Promise.all([
      Message.deleteMany({ sessionId: { $in: sessionIds } }),
      SupportSession.deleteMany({ _id: { $in: sessionIds } }),
      PushSubscription.deleteMany({ userId }),
      InAppNotification.deleteMany({ userId }),
      CounselorProfile.deleteMany({ userId }),
    ]);
    await User.findByIdAndDelete(userId);
    return NextResponse.json({ ok: true });
  }

  /* ─── تعيين كلمة مرور جديدة لأي حساب (بلا حاجة للكلمة القديمة) ─── */
  if (action === "set-password") {
    const { userId, newPassword } = body;
    if (!userId || !newPassword || String(newPassword).length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    const pw = hashSecret(String(newPassword));
    const r = await User.updateOne(
      { _id: userId },
      { $set: { passwordHash: pw.hash, passwordSalt: pw.salt } }
    );
    if (!r.matchedCount) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  /* ─── إنشاء حساب مباشرة من لوحة الإدارة (متضرر أو أخصائي) ─── */
  if (action === "create-account") {
    const { role, pseudonym, email, password, recoveryPhrase, fullName, whatsapp, wilaya, ageGroup, gender, phone, language, specialties, languages, bio, yearsExperience, verified } = body;
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    const pw = hashSecret(String(password));
    /* عبارة الاسترجاع: ما كتبه الأدمين أو كلمة المرور نفسها كبديل */
    const rec = hashSecret(String(recoveryPhrase || password).trim());

    if (role === "VICTIM") {
      const name = String(pseudonym || "").trim();
      if (!name || name.length < 3) {
        return NextResponse.json({ error: "PSEUDONYM_REQUIRED" }, { status: 400 });
      }
      const existing = await User.findOne({ role: "VICTIM", pseudonym: new RegExp(`^${escapeRegExp(name)}$`, "i") }).lean();
      if (existing) return NextResponse.json({ error: "PSEUDONYM_TAKEN" }, { status: 409 });
      /* v2.8.0: كل الحقول مثل التسجيل العادي — الولاية، الفئة العمرية، الجنس، الهاتف */
      const cleanPhone = phone ? normalizeWhatsapp(String(phone)) : null;
      if (phone && !cleanPhone) return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
      const user = await User.create({
        role: "VICTIM",
        pseudonym: name,
        language: language || "ar",
        wilaya: wilaya || null,
        ageGroup: ageGroup || null,
        gender: gender === "male" || gender === "female" ? gender : null,
        phone: cleanPhone,
        passwordHash: pw.hash,
        passwordSalt: pw.salt,
        recoveryHash: rec.hash,
        recoverySalt: rec.salt,
      });
      return NextResponse.json({ ok: true, userId: user._id.toString() });
    }

    if (role === "COUNSELOR") {
      const name = String(fullName || "").trim();
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!name || !cleanEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const existing = await User.findOne({ email: cleanEmail }).lean();
      if (existing) return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
      const wa = whatsapp ? normalizeWhatsapp(whatsapp) : null;
      if (whatsapp && !wa) return NextResponse.json({ error: "INVALID_WHATSAPP" }, { status: 400 });
      const user = await User.create({
        role: "COUNSELOR",
        email: cleanEmail,
        language: language || "ar",
        pseudonym: name,
        passwordHash: pw.hash,
        passwordSalt: pw.salt,
        recoveryHash: rec.hash,
        recoverySalt: rec.salt,
      });
      await CounselorProfile.create({
        userId: user._id,
        fullName: name,
        specialties: Array.isArray(specialties) && specialties.length ? specialties : ["trauma"],
        languages: Array.isArray(languages) && languages.length ? languages : ["ar"],
        whatsapp: wa,
        bio: bio || null,
        yearsExperience: Number(yearsExperience) || 0,
        verificationStatus: verified ? "VERIFIED" : "PENDING",
        available: true,
      });
      return NextResponse.json({ ok: true, userId: user._id.toString() });
    }

    return NextResponse.json({ error: "Unsupported role" }, { status: 400 });
  }

  if (action === "pending-counselors") {
    /* v2.8.0 أداء: الصورة الشخصية base64 مستبعدة من القائمة — فقط صورة الشهادة
       تُحمّل (تحتاجها الإدارة للتوثيق) — كان هذا الاستعلام يجرّ كل الصور لكل زيارة */
    const profiles = await CounselorProfile.find().sort({ createdAt: -1 }).select("-photo").lean();
    const userIds = profiles.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).select("email").lean();
    const emailById = new Map(users.map((u) => [String(u._id), u.email]));

    const mapped = profiles.map((p) => ({
      id: String(p._id),
      userId: String(p.userId),
      fullName: p.fullName,
      email: emailById.get(String(p.userId)) ?? null,
      whatsapp: p.whatsapp || null,
      specialties: p.specialties || [],
      languages: p.languages || [],
      bio: p.bio ?? null,
      yearsExperience: p.yearsExperience ?? 0,
      diplomaImage: p.diplomaImage || null,
      verificationStatus: p.verificationStatus,
      available: !!p.available,
      rating: p.rating ?? 5,
      sessionsCount: p.sessionsCount ?? 0,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      pending: mapped.filter((p) => p.verificationStatus === "PENDING"),
      all: mapped,
    });
  }

  if (action === "verify" || action === "reject" || action === "unverify") {
    const { profileId } = body;
    if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });
    const status = action === "verify" ? "VERIFIED" : action === "reject" ? "REJECTED" : "PENDING";
    await CounselorProfile.findByIdAndUpdate(profileId, { $set: { verificationStatus: status } });
    return NextResponse.json({ ok: true });
  }

  /* ─── الملاحظات والبلاغات: قائمة + حذف + تعيين كمعالجة ─── */
  if (action === "feedback-list") {
    const items = await Feedback.find().sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json({
      feedbacks: items.map((f) => ({
        id: String(f._id),
        type: f.type,
        subject: f.subject ?? "",
        message: f.message,
        contact: f.contact ?? null,
        handled: !!f.handled,
        createdAt: f.createdAt,
      })),
    });
  }

  if (action === "feedback-delete") {
    const { feedbackId } = body;
    if (!feedbackId) return NextResponse.json({ error: "feedbackId required" }, { status: 400 });
    await Feedback.findByIdAndDelete(feedbackId);
    return NextResponse.json({ ok: true });
  }

  if (action === "feedback-handled") {
    const { feedbackId, handled } = body;
    if (!feedbackId) return NextResponse.json({ error: "feedbackId required" }, { status: 400 });
    await Feedback.findByIdAndUpdate(feedbackId, { $set: { handled: !!handled } });
    return NextResponse.json({ ok: true });
  }

  if (action === "crisis-log") {
    /* سجل مُثرى (v2.5.4): الاسم المستعار للمتضرر + اسم الأخصائي + من كتب العبارة */
    const logs = await listEnrichedCrisisLogs();
    return NextResponse.json({ logs });
  }

  if (action === "stats") {
    const [users, sessions, verifiedCounselors, crises, completed, byModeAgg] = await Promise.all([
      User.countDocuments(),
      SupportSession.countDocuments(),
      CounselorProfile.countDocuments({ verificationStatus: "VERIFIED" }),
      CrisisLog.countDocuments(),
      SupportSession.countDocuments({ status: "COMPLETED" }),
      SupportSession.aggregate([{ $group: { _id: "$mode", count: { $sum: 1 } } }]),
    ]);
    const byMode = byModeAgg.map((m) => ({ mode: m._id, _count: m.count }));
    return NextResponse.json({
      stats: { users, sessions, verifiedCounselors, crises, completed, byMode },
    });
  }

  /* ─── v2.7.0: حالة التحدي — الفائز يظهر دائماً في لوحة الإدارة ───
     يُرجع معلومات الفائز (الاسم، تاريخ الفوز، معرّف الملف للصورة) وإحصاءات المشاركة */
  if (action === "challenge-status") {
    const status = await challengeStatus(null);
    return NextResponse.json({ ok: true, winner: status.winner, active: status.active });
  }

  /* ─── تصدير البيانات: قائمة الجلسات الكاملة (يحوّلها العميل إلى Excel/CSV) ─── */
  if (action === "list-sessions") {
    const sessions = await SupportSession.find()
      .sort({ createdAt: -1 })
      .limit(1000)
      .populate("victimId", "pseudonym")
      .populate("counselorId", "pseudonym")
      .lean();
    return NextResponse.json({
      sessions: sessions.map((s: Record<string, unknown>) => {
        const victim = s.victimId as { pseudonym?: string } | null;
        const counselor = s.counselorId as { pseudonym?: string } | null;
        return {
          id: String(s._id),
          topic: s.topic,
          mode: s.mode,
          status: s.status,
          scheduledAt: s.scheduledAt,
          victim: victim?.pseudonym ?? null,
          counselor: counselor?.pseudonym ?? null,
          moodBefore: s.moodBefore ?? null,
          moodAfter: s.moodAfter ?? null,
          crisisFlag: !!s.crisisFlag,
        };
      }),
    });
  }

  /* ─── v2.6.0: الطلبات المعلّقة لأخصائي معيّن (زر بجانب كل حساب أخصائي) ───
     كل تفاصيل الطلب: المتضرر المستعار + تاريخ الإنشاء الكامل
     (YYYY/MM/DD HH:MM:SS) + الموضوع والوسيط والموعد المطلوب */
  if (action === "counselor-requests") {
    const { counselorUserId } = body;
    if (!counselorUserId) return NextResponse.json({ error: "counselorUserId required" }, { status: 400 });
    const sessions = await SupportSession.find({ counselorId: counselorUserId, status: "PENDING" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const victimIds = sessions.map((s) => (s as unknown as { victimId: unknown }).victimId);
    const victims = await User.find({ _id: { $in: victimIds } }).select("pseudonym").lean();
    const victimById = new Map(victims.map((v) => [String(v._id), (v as { pseudonym?: string }).pseudonym ?? null]));
    const now = Date.now();
    return NextResponse.json({
      requests: sessions.map((s) => {
        const doc = s as unknown as { _id: unknown; victimId: unknown; createdAt?: Date; scheduledAt?: Date; topic?: string; mode?: string };
        return {
          id: String(doc._id),
          victimAlias: victimById.get(String(doc.victimId)) ?? null,
          createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
          scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString() : null,
          topic: doc.topic ?? null,
          mode: doc.mode ?? null,
          hoursPending: doc.createdAt ? Math.floor((now - new Date(doc.createdAt).getTime()) / 3600000) : 0,
        };
      }),
    });
  }

  /* ─── v2.6.0: المسح الدوري للطلبات المتأخرة +36 ساعة ───
     يوسم الطلبات، يزيد عدّاد التأخر للأخصائي، يُعلّق الحساب عند 3 تأخرات،
     ويُبلغ الأدمين (إشعار داخلي) — ثم يعيد القائمة الحالية للافتة اللوحة */
  if (action === "overdue-requests") {
    await sweepOverdueRequests();
    const overdue = await listOverdueRequests();
    return NextResponse.json({ overdue });
  }

  /* ─── v2.6.0: تفعيل / تعطيل أي حساب (أخصائي أو متضرر) من الإدارة ───
     إعادة تفعيل الأخصائي تُصفّر عدّاد التأخر — بداية جديدة */
  if (action === "toggle-user") {
    const { userId, suspended } = body;
    if (!userId || typeof suspended !== "boolean") {
      return NextResponse.json({ error: "userId and suspended required" }, { status: 400 });
    }
    const target = await User.findById(userId).select("role").lean();
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if ((target as { role?: string }).role === "ADMIN") {
      return NextResponse.json({ error: "CANNOT_SUSPEND_ADMIN" }, { status: 400 });
    }
    await User.updateOne({ _id: userId }, { $set: { suspended } });
    if (!suspended) {
      await CounselorProfile.updateOne({ userId }, { $set: { lateCount: 0 } });
    }
    return NextResponse.json({ ok: true, suspended });
  }

  /* ─── v2.8.0: تبويب الطلبات الملغاة — كل الطلبات المرفوضة/الملغاة بتفاصيلها ───
     الاسم المستعار للمتضرر + اسم الأخصائي + سبب التعذّر + من ألغى + المواعيد */
  if (action === "cancelled-requests") {
    const sessions = await SupportSession.find({ status: "CANCELLED" })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const ids = [
      ...new Set(
        sessions.flatMap((x) => {
          const doc = x as unknown as { victimId: unknown; counselorId: unknown };
          return [String(doc.victimId), String(doc.counselorId)];
        })
      ),
    ];
    const users = await User.find({ _id: { $in: ids } }).select("pseudonym").lean();
    const profiles = await CounselorProfile.find({ userId: { $in: ids } }).select("userId fullName").lean();
    const nameById = new Map(users.map((u) => [String(u._id), (u as { pseudonym?: string }).pseudonym ?? null]));
    const fullNameByUserId = new Map(profiles.map((pf) => [String(pf.userId), (pf as { fullName?: string }).fullName ?? null]));

    return NextResponse.json({
      cancelled: sessions.map((x) => {
        const doc = x as unknown as {
          _id: unknown; victimId: unknown; counselorId: unknown; topic?: string; mode?: string;
          scheduledAt?: Date; createdAt?: Date; updatedAt?: Date;
          cancelReason?: string | null; cancelledBy?: string | null;
        };
        return {
          id: String(doc._id),
          victimAlias: nameById.get(String(doc.victimId)) ?? null,
          counselorName: fullNameByUserId.get(String(doc.counselorId)) ?? nameById.get(String(doc.counselorId)) ?? null,
          topic: doc.topic ?? null,
          mode: doc.mode ?? null,
          scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString() : null,
          createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
          cancelledAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
          cancelReason: doc.cancelReason || null,
          cancelledBy: doc.cancelledBy || null,
        };
      }),
    });
  }

  /* ─── v2.8.0: حذف طلب معلق مباشرة من المنصة (الأدمين) — مع رسائله */
  if (action === "delete-session") {
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const target = await SupportSession.findById(sessionId).select("status").lean();
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await Message.deleteMany({ sessionId });
    await SupportSession.findByIdAndDelete(sessionId);
    return NextResponse.json({ ok: true });
  }

  /* ─── v2.8.0: الإشعار الجماعي — لكل المتضررين أو المختصين أو مستخدم معيّن أو الجميع ─── */
  if (action === "bulk-notify") {
    const { target, userId, textAr, textFr, textEn } = body;
    const ta = String(textAr || "").trim();
    if (!ta) return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
    if (!["ALL_VICTIMS", "ALL_COUNSELORS", "ALL", "USER"].includes(String(target))) {
      return NextResponse.json({ error: "BAD_TARGET" }, { status: 400 });
    }
    if (String(target) === "USER") {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const u = (await User.findById(userId).select("_id").lean()) as unknown as { _id: unknown } | null;
      if (!u) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      const r = await notifyBulk([String(u._id)], ta, String(textFr || "").trim() || undefined, String(textEn || "").trim() || undefined);
      return NextResponse.json({ ok: true, sent: r.sent, count: 1 });
    }
    const filter: Record<string, unknown> = { suspended: false };
    if (target === "ALL_VICTIMS") filter.role = "VICTIM";
    else if (target === "ALL_COUNSELORS") filter.role = "COUNSELOR";
    const users = (await User.find(filter).select("_id").limit(5000).lean()) as unknown as { _id: unknown }[];
    const r = await notifyBulk(users.map((u) => String(u._id)), ta, String(textFr || "").trim() || undefined, String(textEn || "").trim() || undefined);
    return NextResponse.json({ ok: true, sent: r.sent, count: users.length });
  }

  /* ─── v2.8.0: صفحة المؤسسين — قراءة وحفظ من تبويب خاص باللوحة ─── */
  if (action === "founders-get") {
    const doc = (await FoundersContent.findOne({ key: "founders" }).lean()) as Record<string, unknown> | null;
    return NextResponse.json({
      content: {
        textAr: (doc?.textAr as string) ?? "",
        textFr: (doc?.textFr as string) ?? "",
        textEn: (doc?.textEn as string) ?? "",
        developerName: (doc?.developerName as string) ?? "",
        developerRole: (doc?.developerRole as string) ?? "",
        members: Array.isArray(doc?.members) ? doc?.members : [],
      },
    });
  }

  if (action === "founders-save") {
    const { textAr, textFr, textEn, developerName, developerRole, members } = body;
    if (!String(textAr || "").trim() || !String(textFr || "").trim() || !String(textEn || "").trim()) {
      return NextResponse.json({ error: "MISSING_LANGUAGES" }, { status: 400 });
    }
    const cleanMembers = Array.isArray(members)
      ? members
          .map((m: { name?: unknown; role?: unknown }) => ({
            name: String(m?.name ?? "").trim().slice(0, 120),
            role: String(m?.role ?? "").trim().slice(0, 120),
          }))
          .filter((m: { name: string }) => m.name)
          .slice(0, 100)
      : [];
    await FoundersContent.findOneAndUpdate(
      { key: "founders" },
      {
        $set: {
          textAr: String(textAr).slice(0, 5000),
          textFr: String(textFr).slice(0, 5000),
          textEn: String(textEn).slice(0, 5000),
          developerName: String(developerName || "").trim().slice(0, 120),
          developerRole: String(developerRole || "").trim().slice(0, 120),
          members: cleanMembers,
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  }

  /* ─── v2.9.0: لوحة القيادة — كل الإحصائيات التي يحتاجها الأدمين في صفحة واحدة ─── */
  if (action === "dashboard-stats") {
    const now = new Date();
    const todayKey = dayKeyUTC1(now);
    const dayStart = new Date(`${todayKey}T00:00:00+01:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const weekStart = dayStart - 6 * 24 * 60 * 60 * 1000;

    const [
      totalVictims,
      totalCounselors,
      pendingCounselors,
      suspendedUsers,
      totalSessions,
      pendingSessions,
      acceptedSessions,
      activeSessions,
      completedSessions,
      cancelledSessions,
      todaySessions,
      weekSessions,
      crisisCount,
      feedbackUnhandled,
      messagesCount,
      genderAgg,
      wilayaAgg,
      counselorLoad,
      firePending,
      victimWinner,
      counselorWinner,
    ] = await Promise.all([
      User.countDocuments({ role: "VICTIM" }),
      User.countDocuments({ role: "COUNSELOR" }),
      CounselorProfile.countDocuments({ verificationStatus: "PENDING" }),
      User.countDocuments({ suspended: true }),
      SupportSession.countDocuments(),
      SupportSession.countDocuments({ status: "PENDING" }),
      SupportSession.countDocuments({ status: "ACCEPTED" }),
      SupportSession.countDocuments({ status: "ACTIVE" }),
      SupportSession.countDocuments({ status: "COMPLETED" }),
      SupportSession.countDocuments({ status: "CANCELLED" }),
      SupportSession.countDocuments({ scheduledAt: { $gte: new Date(dayStart), $lt: new Date(dayEnd) } }),
      SupportSession.countDocuments({ scheduledAt: { $gte: new Date(weekStart), $lt: new Date(dayEnd) } }),
      CrisisLog.countDocuments(),
      Feedback.countDocuments({ handled: false }),
      Message.countDocuments({}),
      User.aggregate([{ $match: { role: "VICTIM" } }, { $group: { _id: "$gender", n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { role: "VICTIM", wilaya: { $ne: null } } }, { $group: { _id: "$wilaya", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }]),
      SupportSession.aggregate([
        { $match: { status: { $in: ["ACCEPTED", "ACTIVE", "COMPLETED"] } } },
        { $group: { _id: "$counselorId", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 5 },
      ]),
      User.countDocuments({ role: "VICTIM", "fireCase.declared": true, "fireCase.status": "PENDING" }),
      getVictimChallengeWinner(),
      challengeStatus(null).then((s) => s.winner),
    ]);

    /* sessions آخرة 14 يوماً — رسم بياني مبسّط في اللوحة */
    const dailyAgg = await SupportSession.aggregate([
      { $match: { createdAt: { $gte: new Date(dayStart - 13 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { date: "$createdAt", timezone: "+01:00", format: "%Y-%m-%d" } },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const daily: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(dayStart - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const hit = dailyAgg.find((x) => x._id === key);
      daily.push({ day: key, count: hit ? hit.n : 0 });
    }

    /* أسماء أعلى الأخصائيين حملاً */
    const loadIds = counselorLoad.map((c) => String(c._id));
    const loadUsers = loadIds.length
      ? await CounselorProfile.find({ userId: { $in: loadIds } }).select("userId fullName").lean()
      : [];
    const nameByUid = new Map(loadUsers.map((p: Record<string, unknown>) => [String(p.userId), p.fullName as string]));

    return NextResponse.json({
      stats: {
        users: { totalVictims, totalCounselors, pendingCounselors, suspendedUsers },
        sessions: { totalSessions, pendingSessions, acceptedSessions, activeSessions, completedSessions, cancelledSessions, todaySessions, weekSessions },
        crisisCount,
        feedbackUnhandled,
        messagesCount,
        firePending,
        gender: genderAgg.map((g) => ({ key: g._id ?? "unknown", n: g.n })),
        wilayas: wilayaAgg.map((w) => ({ key: w._id, n: w.n })),
        counselorLoad: counselorLoad.map((c) => ({ name: nameByUid.get(String(c._id)) || "—", n: c.n })),
        daily,
        victims: { victimWinner, counselorWinner },
      },
    });
  }

  /* ─── v2.9.0: مراجعة طلبات توثيق المتضررين من الحرائق ─── */
  if (action === "victim-verifications") {
    const victims = await User.find({
      role: "VICTIM",
      "fireCase.declared": true,
      "fireCase.status": body.status || "PENDING",
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      victims: victims.map((v) => ({
        id: String(v._id),
        pseudonym: v.pseudonym,
        wilaya: v.wilaya ?? null,
        gender: v.gender ?? null,
        phone: v.phone ?? null,
        createdAt: v.createdAt,
        fireCase: {
          commune: (v as { fireCase?: { commune?: string } }).fireCase?.commune ?? null,
          incidentDate: (v as { fireCase?: { incidentDate?: string } }).fireCase?.incidentDate ?? null,
          description: (v as { fireCase?: { description?: string } }).fireCase?.description ?? null,
          status: (v as { fireCase?: { status?: string } }).fireCase?.status ?? "PENDING",
        },
      })),
    });
  }

  /* ─── v2.9.0: قرار الإدارة في طلب توثيق متضرر — موافقة/رفض + إشعار تلقائي ─── */
  if (action === "verify-victim") {
    const { victimId, approve } = body;
    if (!victimId) return NextResponse.json({ error: "victimId required" }, { status: 400 });
    const status = approve ? "VERIFIED" : "REJECTED";
    const r = await User.updateOne(
      { _id: victimId, role: "VICTIM" },
      { $set: { "fireCase.status": status, "fireCase.reviewedAt": new Date() } }
    );
    if (!r.matchedCount) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    notifyVictimVerification(String(victimId), !!approve).catch(() => {});
    return NextResponse.json({ ok: true, status });
  }

  /* ─── v2.10.0: صندوق محادثات المختصين مع الإدارة ───
     يجمّع خيوط admin:{counselorId} مع آخر رسالة وعددها واسم المختص،
     مرتبة من الأحدث — تُعرض في تبويب «رسائل المختصين» بلوحة الإدارة. */
  if (action === "admin-threads") {
    const msgs = (await Message.find({ threadKey: { $regex: /^admin:/ } })
      .sort({ createdAt: -1 })
      .limit(800)
      .select("threadKey senderRole senderName content createdAt")
      .lean()) as {
      threadKey?: string | null;
      senderRole?: string;
      senderName?: string | null;
      content?: string;
      createdAt?: Date;
    }[];
    const byThread = new Map<
      string,
      { lastAt: string; count: number; lastRole: string; lastContent: string; lastSender: string }
    >();
    for (const m of msgs) {
      const k = String(m.threadKey || "");
      if (!k) continue;
      const cur = byThread.get(k);
      if (!cur) {
        byThread.set(k, {
          lastAt: new Date(m.createdAt as unknown as string).toISOString(),
          count: 1,
          lastRole: String(m.senderRole || ""),
          lastContent: String(m.content || ""),
          lastSender: String(m.senderName || ""),
        });
      } else {
        cur.count += 1;
      }
    }
    const threads: Record<string, unknown>[] = [];
    for (const [key, v] of byThread) {
      const cid = key.split(":")[1] || "";
      let counselorName = "—";
      if (/^[a-f\d]{24}$/i.test(cid)) {
        const u = (await User.findById(cid).select("pseudonym").lean()) as { pseudonym?: string } | null;
        counselorName = u?.pseudonym || "—";
      }
      threads.push({ key, counselorId: cid, counselorName, ...v });
    }
    threads.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
    return NextResponse.json({ ok: true, threads });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export const POST = apiHandler(POST_impl);
