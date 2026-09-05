import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { hashSecret, verifySecret } from "@/lib/server/auth";
import { apiHandler } from "@/lib/server/api";
import { normalizeWhatsapp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * حسابات المتضررين: تسجيل / دخول / نسيان كلمة المرور
 * الاسم المستعار هو معرّف الدخول — يبقى الحساب محفوظاً للتواصل الدائم
 * مع الأخصائي وسجل الجلسات والمحادثات.
 */

interface RegisterBody {
  action: "register";
  pseudonym: string;
  password: string;
  recoveryPhrase: string;
  language?: string;
  wilaya?: string;
  ageGroup?: string;
  gender?: string;
  /* v2.7.0: رقم الهاتف (اختياري) — لا يظهر إلا لأخصائي الجلسة التي يختارها */
  phone?: string;
  /* v2.9.0: إثبات التضرر من الحرائق — يراجعه الأدمين قبل السماح بالحجز */
  fireVictim?: boolean;
  fireCommune?: string;
  fireDate?: string;
  fireDesc?: string;
}

interface LoginBody {
  action: "login";
  pseudonym: string;
  password: string;
}

interface ForgotBody {
  action: "forgot";
  pseudonym: string;
  recoveryPhrase: string;
  newPassword: string;
}

interface UpdateProfileBody {
  action: "update-profile";
  userId: string;
  wilaya?: string;
  ageGroup?: string;
  language?: string;
  gender?: string;
  phone?: string;
}

interface ChangePasswordBody {
  action: "change-password";
  userId: string;
  oldPassword: string;
  newPassword: string;
}

function shapeUser(u: any) {
  const fc = (u as { fireCase?: { declared?: boolean; status?: string } | null }).fireCase ?? null;
  return {
    id: String(u._id),
    role: u.role,
    pseudonym: u.pseudonym,
    language: u.language,
    wilaya: u.wilaya,
    ageGroup: u.ageGroup,
    gender: u.gender ?? null,
    /* هاتفي الخاص — يظهر لي وحدي في حسابي وإعداداتي */
    phone: (u as { phone?: string | null }).phone ?? null,
    /* v2.9.0: حالة التحقق من التضرر من الحرائق — تحكم بقدرة الحجز */
    fireDeclared: !!fc?.declared,
    fireStatus: fc?.declared ? fc.status ?? "PENDING" : "VERIFIED",
  };
}

async function POST_impl(req: NextRequest) {
  const body = await req.json();
  await connectDB();

  if (body.action === "register") {
    const { pseudonym, password, recoveryPhrase, language, wilaya, ageGroup } = body as RegisterBody;
    const name = String(pseudonym || "").trim();
    if (!name || name.length < 3) {
      return NextResponse.json({ error: "PSEUDONYM_REQUIRED" }, { status: 400 });
    }
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    if (!recoveryPhrase || String(recoveryPhrase).trim().length < 6) {
      return NextResponse.json({ error: "WEAK_RECOVERY" }, { status: 400 });
    }

    /* v2.7.0: رقم الهاتف اختياري — إن وُجد يُطبَّع دولياً (05… → 213…)
       ويُرفض إن كان غير صالح، لضمان عمل زر واتساب عند الأخصائي */
    const rawPhone = String((body as RegisterBody).phone || "").trim();
    const phone = rawPhone ? normalizeWhatsapp(rawPhone) : null;
    if (rawPhone && !phone) {
      return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    }

    /* الاسم المستعار فريد بين المتضررين (بدون حساسية لحالة الأحرف) */
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await User.findOne({ role: "VICTIM", pseudonym: new RegExp(`^${escaped}$`, "i") }).lean();
    if (existing) {
      return NextResponse.json({ error: "PSEUDONYM_TAKEN" }, { status: 409 });
    }

    const pw = hashSecret(password);
    const rec = hashSecret(recoveryPhrase.trim());
    const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
    /* v2.9.0: بيانات إثبات التضرر من الحرائق — declared=true يحتاج مراجعة الأدمين
       قبل الحجز (VICTIM_UNVERIFIED)؛ من لم يعلن تضرره يُحجز فوراً كالسابق */
    const fireDeclared = !!body.fireVictim;
    const fireCase = fireDeclared
      ? {
          declared: true,
          commune: String(body.fireCommune || "").trim().slice(0, 120) || null,
          incidentDate: String(body.fireDate || "").trim().slice(0, 30) || null,
          description: String(body.fireDesc || "").trim().slice(0, 800) || null,
          status: "PENDING" as const,
          reviewedAt: null,
        }
      : undefined;
    const user = await User.create({
      role: "VICTIM",
      pseudonym: name,
      language: language || "ar",
      wilaya: wilaya || null,
      ageGroup: ageGroup || null,
      gender,
      phone,
      ...(fireCase ? { fireCase } : {}),
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      recoveryHash: rec.hash,
      recoverySalt: rec.salt,
    });
    return NextResponse.json({ ok: true, user: shapeUser(user) });
  }

  if (body.action === "login") {
    const { pseudonym, password } = body as LoginBody;
    const name = String(pseudonym || "").trim();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({ role: "VICTIM", pseudonym: new RegExp(`^${escaped}$`, "i") });
    if (!user || !verifySecret(password, user.passwordHash, user.passwordSalt)) {
      return NextResponse.json({ error: "INVALID" }, { status: 401 });
    }
    /* v2.6.0: الحساب المعلّق من الإدارة لا يستطيع الولوج */
    if ((user as unknown as { suspended?: boolean }).suspended) {
      return NextResponse.json({ error: "SUSPENDED" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, user: shapeUser(user) });
  }

  /* نسيان كلمة المرور: الاسم المستعار + عبارة الاسترجاع المسجلة عند إنشاء الحساب */
  if (body.action === "forgot") {
    const { pseudonym, recoveryPhrase, newPassword } = body as ForgotBody;
    if (!newPassword || String(newPassword).length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    const name = String(pseudonym || "").trim();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({ role: "VICTIM", pseudonym: new RegExp(`^${escaped}$`, "i") });
    if (!user || !verifySecret(String(recoveryPhrase || "").trim(), user.recoveryHash, user.recoverySalt)) {
      return NextResponse.json({ error: "RECOVERY_INVALID" }, { status: 401 });
    }
    const pw = hashSecret(newPassword);
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: pw.hash, passwordSalt: pw.salt } }
    );
    return NextResponse.json({ ok: true });
  }

  /* تعديل معلومات الحساب من صفحة الإعدادات (الولاية/الفئة/اللغة — الاسم ثابت) */
  if (body.action === "update-profile") {
    const { userId, wilaya, ageGroup, language } = body as UpdateProfileBody;
    const user = await User.findById(userId);
    if (!user || user.role !== "VICTIM") {
      return NextResponse.json({ error: "INVALID" }, { status: 401 });
    }
    const set: Record<string, unknown> = {};
    if (wilaya !== undefined) set.wilaya = wilaya || null;
    if (ageGroup !== undefined) set.ageGroup = ageGroup || null;
    if (language === "ar" || language === "fr" || language === "en") set.language = language;
    if (body.gender === "male" || body.gender === "female") set.gender = body.gender;
    /* v2.7.0: تحديث رقم الهاتف اختيارياً — نفس قواعد التسجيل */
    if (body.phone !== undefined) {
      const rawPhone = String(body.phone || "").trim();
      if (!rawPhone) {
        set.phone = null;
      } else {
        const normalized = normalizeWhatsapp(rawPhone);
        if (!normalized) return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
        set.phone = normalized;
      }
    }
    if (Object.keys(set).length) await User.updateOne({ _id: userId }, { $set: set });
    const fresh = await User.findById(userId).lean();
    return NextResponse.json({ ok: true, user: fresh ? shapeUser(fresh) : null });
  }

  /* تغيير كلمة المرور من الإعدادات (بالكلمة الحالية) */
  if (body.action === "change-password") {
    const { userId, oldPassword, newPassword } = body as ChangePasswordBody;
    if (!newPassword || String(newPassword).length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== "VICTIM" || !verifySecret(String(oldPassword || ""), user.passwordHash, user.passwordSalt)) {
      return NextResponse.json({ error: "INVALID" }, { status: 401 });
    }
    const pw = hashSecret(newPassword);
    await User.updateOne(
      { _id: userId },
      { $set: { passwordHash: pw.hash, passwordSalt: pw.salt } }
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export const POST = apiHandler(POST_impl);
