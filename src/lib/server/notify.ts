import "server-only";
import { InAppNotification, User } from "@/lib/models";
import { sendPushToUser } from "@/lib/server/push";

type NotifKey =
  | "booked"
  | "accepted"
  | "started"
  | "declined"
  | "feedback"
  | "followUp"
  | "treatmentEnded"
  | "message"
  | "rescheduled"
  | "declinedReason"
  | "dm"
  | "adminChat"
  | "bulk"
  | "victimVerified"
  | "victimRejected"
  | "victimChallenge"
  | "test";

type NotifLang = "ar" | "fr" | "en" | "tr" | "ru" | "zh";

const TEXTS: Record<NotifKey, Record<NotifLang, { title: string; body: string }>> = {
  booked: {
    ar: { title: "🔔 طلب جلسة جديد", body: "متضرر جديد يطلب جلسة دعم — راجع لوحتك" },
    fr: { title: "🔔 Nouvelle demande de séance", body: "Une victime demande du soutien — consultez votre tableau de bord" },
    en: { title: "🔔 New session request", body: "A victim is requesting support — check your dashboard" },
    tr: { title: "🔔 Yeni seans talebi", body: "Bir mağdur destek talep ediyor — panonuzu kontrol edin" },
    ru: { title: "🔔 Новый запрос на сессию", body: "Пострадавший просит поддержки — проверьте свою панель" },
    zh: { title: "🔔 新的会话请求", body: "一位受害者正在寻求支持——请查看您的控制面板" },
  },
  accepted: {
    ar: { title: "✅ قُبلت جلسة الدعم", body: "أكّد الأخصائي حجزك — ستصلك تفاصيل الغرفة الآمنة" },
    fr: { title: "✅ Séance acceptée", body: "Le professionnel a confirmé votre réservation" },
    en: { title: "✅ Session accepted", body: "Your counselor confirmed your booking" },
    tr: { title: "✅ Seans kabul edildi", body: "Uzman rezervasyonunuzu onayladı" },
    ru: { title: "✅ Сессия принята", body: "Специалист подтвердил вашу запись" },
    zh: { title: "✅ 会话已接受", body: "专家已确认您的预约" },
  },
  started: {
    ar: { title: "🟢 جلستك بدأت الآن", body: "الأخصائي في انتظارك داخل الغرفة الآمنة" },
    fr: { title: "🟢 Votre séance commence", body: "Le professionnel vous attend dans la salle sécurisée" },
    en: { title: "🟢 Your session is starting", body: "Your counselor is waiting in the safe room" },
    tr: { title: "🟢 Seansınız başlıyor", body: "Uzman güvenli odada sizi bekliyor" },
    ru: { title: "🟢 Ваша сессия начинается", body: "Специалист ждёт вас в безопасной комнате" },
    zh: { title: "🟢 您的会话即将开始", body: "专家正在安全房间中等候您" },
  },
  declined: {
    ar: { title: "ℹ️ بخصوص طلب الجلسة", body: "اعتذر الأخصائي — يمكنك حجز جلسة مع أخصائي آخر فوراً" },
    fr: { title: "ℹ️ Concernant votre demande", body: "Le professionnel est indisponible — réservez avec un autre" },
    en: { title: "ℹ️ About your request", body: "Counselor unavailable — book with another one anytime" },
    tr: { title: "ℹ️ Talebiniz hakkında", body: "Uzman müsait değil — istediğiniz zaman başka bir uzmanla rezervasyon yapabilirsiniz" },
    ru: { title: "ℹ️ О вашем запросе", body: "Специалист недоступен — вы можете записаться к другому в любое время" },
    zh: { title: "ℹ️ 关于您的请求", body: "专家暂无空档——您可以随时预约其他专家" },
  },
  feedback: {
    ar: { title: "💚 متابعة أسبوعية", body: "كيف تشعر هذا الأسبوع؟ سجل تقييمك السريع" },
    fr: { title: "💚 Suivi hebdomadaire", body: "Comment vous sentez-vous cette semaine ?" },
    en: { title: "💚 Weekly follow-up", body: "How are you feeling this week? Quick check-in" },
    tr: { title: "💚 Haftalık takip", body: "Bu hafta kendinizi nasıl hissediyorsunuz? Hızlı değerlendirme" },
    ru: { title: "💚 Еженедельная связь", body: "Как вы себя чувствуете на этой неделе? Быстрая оценка" },
    zh: { title: "💚 每周回访", body: "本周您感觉如何？请快速记录您的状态" },
  },
  followUp: {
    ar: { title: "📅 حُددت جلسة المتابعة", body: "أخصائيك جدول الجلسة القادمة — راجع جلساتك للموعد" },
    fr: { title: "📅 Séance de suivi programmée", body: "Votre professionnel a planifié la prochaine séance — consultez vos séances" },
    en: { title: "📅 Follow-up scheduled", body: "Your counselor scheduled the next session — check your sessions" },
    tr: { title: "📅 Takip seansı planlandı", body: "Uzmanınız bir sonraki seansı planladı — seanslarınıza bakın" },
    ru: { title: "📅 Запланирована следующая сессия", body: "Ваш специалист назначил следующую встречу — проверьте свои сессии" },
    zh: { title: "📅 已安排后续会话", body: "您的专家已安排下一次会话——请查看您的会话列表" },
  },
  treatmentEnded: {
    ar: { title: "🌿 اكتمال مسار المتابعة", body: "أنهى أخصائيك مسار الدعم — أنت لست وحدك، يمكنك الحجز مجدداً في أي وقت" },
    fr: { title: "🌿 Parcours de suivi terminé", body: "Votre professionnel a clos le parcours de soutien — vous pouvez réserver à nouveau à tout moment" },
    en: { title: "🌿 Support journey completed", body: "Your counselor closed the support journey — you can book again anytime" },
    tr: { title: "🌿 Destek yolculuğu tamamlandı", body: "Uzmanınız destek sürecini kapattı — istediğiniz zaman yeniden rezervasyon yapabilirsiniz" },
    ru: { title: "🌿 Путь поддержки завершён", body: "Ваш специалист закрыл программу поддержки — вы можете записаться снова в любое время" },
    zh: { title: "🌿 支持历程已完成", body: "您的专家已结束本次支持历程——您可以随时再次预约" },
  },
  message: {
    ar: { title: "💬 رسالة جديدة في غرفة الجلسة", body: "{name}: {excerpt}" },
    fr: { title: "💬 Nouveau message dans la salle", body: "{name} : {excerpt}" },
    en: { title: "💬 New message in the session room", body: "{name}: {excerpt}" },
    tr: { title: "💬 Seans odasında yeni mesaj", body: "{name}: {excerpt}" },
    ru: { title: "💬 Новое сообщение в комнате сессии", body: "{name}: {excerpt}" },
    zh: { title: "💬 会话房间有新消息", body: "{name}：{excerpt}" },
  },
  /* v2.8.0: تغيير موعد الجلسة قبل القبول — إشعار خاص للمتضرر بالموعد الجديد */
  rescheduled: {
    ar: { title: "🔁 تغيّر موعد جلستك", body: "اقترح الأخصائي موعداً جديداً لجلستك: {when} — راجع جلساتك" },
    fr: { title: "🔁 Horaire de séance modifié", body: "Le professionnel propose un nouvel horaire : {when} — consultez vos séances" },
    en: { title: "🔁 Session time changed", body: "The counselor proposed a new time: {when} — check your sessions" },
    tr: { title: "🔁 Seans saatiniz değişti", body: "Uzman yeni bir saat önerdi: {when} — seanslarınıza bakın" },
    ru: { title: "🔁 Время сессии изменено", body: "Специалист предложил новое время: {when} — проверьте свои сессии" },
    zh: { title: "🔁 会话时间已变更", body: "专家建议了新的时间：{when} —— 请查看您的会话列表" },
  },
  /* v2.8.0: رفض الطلب بسبب مذكور — يصل للمتضرر مع السبب نفسه */
  declinedReason: {
    ar: { title: "ℹ️ اعتذار عن طلب الجلسة", body: "سبب التعذّر: {reason} — يمكنك الحجز مع أخصائي آخر فوراً" },
    fr: { title: "ℹ️ Demande refusée", body: "Motif : {reason} — vous pouvez réserver avec un autre professionnel" },
    en: { title: "ℹ️ Request declined", body: "Reason: {reason} — you can book with another counselor anytime" },
    tr: { title: "ℹ️ Talep reddedildi", body: "Gerekçe: {reason} — istediğiniz zaman başka bir uzmanla rezervasyon yapabilirsiniz" },
    ru: { title: "ℹ️ Запрос отклонён", body: "Причина: {reason} — вы можете записаться к другому специалисту в любое время" },
    zh: { title: "ℹ️ 请求已被婉拒", body: "原因：{reason} —— 您可以随时预约其他专家" },
  },
  /* v2.8.0: رسالة في محادثة ما قبل الجلسة (خيوط DM) — فقط للطرف الغائب */
  dm: {
    ar: { title: "💬 رسالة جديدة", body: "{name}: {excerpt}" },
    fr: { title: "💬 Nouveau message", body: "{name} : {excerpt}" },
    en: { title: "💬 New message", body: "{name}: {excerpt}" },
    tr: { title: "💬 Yeni mesaj", body: "{name}: {excerpt}" },
    ru: { title: "💬 Новое сообщение", body: "{name}: {excerpt}" },
    zh: { title: "💬 新消息", body: "{name}：{excerpt}" },
  },
  /* v2.10.0: رسالة في محادثة المختص مع الإدارة — للطرف الغائب فقط */
  adminChat: {
    ar: { title: "🛡️ رسالة في محادثة الإدارة", body: "{name}: {excerpt}" },
    fr: { title: "🛡️ Message du support administration", body: "{name} : {excerpt}" },
    en: { title: "🛡️ Administration chat message", body: "{name}: {excerpt}" },
    tr: { title: "🛡️ Yönetim sohbeti mesajı", body: "{name}: {excerpt}" },
    ru: { title: "🛡️ Сообщение в чате администрации", body: "{name}: {excerpt}" },
    zh: { title: "🛡️ 管理员聊天新消息", body: "{name}：{excerpt}" },
  },
  /* v2.8.0: الإشعار الجماعي من الإدارة */
  bulk: {
    ar: { title: "📣 إشعار من إدارة المنصة", body: "{text}" },
    fr: { title: "📣 Annonce de l'administration", body: "{text}" },
    en: { title: "📣 Platform administration notice", body: "{text}" },
    tr: { title: "📣 Platform yönetimi duyurusu", body: "{text}" },
    ru: { title: "📣 Объявление администрации", body: "{text}" },
    zh: { title: "📣 平台管理通知", body: "{text}" },
  },
  /* v2.9.0: الموافقة على التحقق من التضرر من الحرائق */
  victimVerified: {
    ar: { title: "✅ تم توثيق حسابك", body: "أكّدت الإدارة أنك من المتضررين من الحرائق — يمكنك الآن حجز جلسات الدعم" },
    fr: { title: "✅ Compte vérifié", body: "L'administration a confirmé que vous êtes sinistré des incendies — vous pouvez réserver des séances" },
    en: { title: "✅ Account verified", body: "Administration confirmed you are a fire victim — you can now book support sessions" },
    tr: { title: "✅ Hesabınız doğrulandı", body: "Yönetim yangın mağduru olduğunuzu onayladı — artık destek seansı ayırtabilirsiniz" },
    ru: { title: "✅ Аккаунт подтверждён", body: "Администрация подтвердила, что вы пострадавший от пожаров — теперь вы можете записываться на сессии" },
    zh: { title: "✅ 账号已通过验证", body: "管理团队已确认您是火灾受害者——现在可以预约支持会话了" },
  },
  /* v2.9.0: رفض التحقق */
  victimRejected: {
    ar: { title: "ℹ️ بخصوص توثيق حسابك", body: "لم تتم الموافقة على طلب التحقق — يمكنك مراسلة الإدارة عبر صفحة اقتراحات التطوير" },
    fr: { title: "ℹ️ Concernant la vérification", body: "La demande de vérification n'a pas été approuvée — contactez l'administration via les suggestions" },
    en: { title: "ℹ️ About your verification", body: "Verification request was not approved — contact administration via the feedback page" },
    tr: { title: "ℹ️ Doğrulama hakkında", body: "Doğrulama talebi onaylanmadı — geri bildirim sayfasından yönetime ulaşabilirsiniz" },
    ru: { title: "ℹ️ О проверке аккаунта", body: "Заявка на проверку не одобрена — свяжитесь с администрацией через страницу отзывов" },
    zh: { title: "ℹ️ 关于账号验证", body: "验证请求未获批准——请通过反馈页面联系管理团队" },
  },
  /* v2.9.0: فائز تحدي الالتزام للمتضررين */
  victimChallenge: {
    ar: { title: "👑 فائز جديد في تحدي الالتزام!", body: "أول من التزم بـ4 مواعيد متتالية: {name} — راجع لوحة الإدارة" },
    fr: { title: "👑 Nouveau gagnant du défi d'assiduité !", body: "Premier à respecter 4 rendez-vous consécutifs : {name} — consultez le panneau d'administration" },
    en: { title: "👑 New commitment challenge winner!", body: "First to keep 4 consecutive appointments: {name} — check the admin panel" },
    tr: { title: "👑 Yeni bağlılık mücadelesi kazananı!", body: "Üst üste 4 randevuya uyan ilk kişi: {name} — yönetim paneline bakın" },
    ru: { title: "👑 Новый победитель челленджа дисциплины!", body: "Первый, кто посетил 4 встречи подряд: {name} — проверьте панель администратора" },
    zh: { title: "👑 新的坚持挑战获胜者！", body: "首个连续赴约4次的人：{name} —— 请查看管理面板" },
  },
  test: {
    ar: { title: "مرحباً بك في رفيقي النفسي 💚", body: "الإشعارات تعمل بنجاح — أنت في أيدٍ أمينة" },
    fr: { title: "Bienvenue sur Rafiqi Annafsi 💚", body: "Les notifications fonctionnent — vous êtes entre de bonnes mains" },
    en: { title: "Welcome to Rafiqi Annafsi 💚", body: "Notifications work perfectly — you're in good hands" },
    tr: { title: "Rafiqi Annafsi'ye hoş geldiniz 💚", body: "Bildirimler sorunsuz çalışıyor — güvenli ellerdesiniz" },
    ru: { title: "Добро пожаловать в Rafiqi Annafsi 💚", body: "Уведомления работают отлично — вы в надёжных руках" },
    zh: { title: "欢迎来到 Rafiqi Annafsi 💚", body: "通知功能运行正常——您在值得信赖的陪伴中" },
  },
};

/** لغة المستخدم من قاعدة البيانات (افتراضي: العربية) — v2.9.0: + تر/روسية/صينية */
const NOTIF_LANGS: NotifLang[] = ["ar", "fr", "en", "tr", "ru", "zh"];
async function langOf(userId: string): Promise<NotifLang> {
  try {
    const user = (await User.findById(userId).select("language").lean()) as { language?: string } | null;
    const lang = user?.language as NotifLang | undefined;
    if (lang && NOTIF_LANGS.includes(lang)) return lang;
  } catch {
    /* معرّف غير صالح (مثل "admin") — العربية افتراضياً */
  }
  return "ar";
}

/** ملء المتغيرات {name} {reason} {when} {excerpt}… داخل نص الإشعار */
function fill(tpl: string, vars?: Record<string, string>): string {
  if (!vars) return tpl;
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

/** اقتباس آمن من نص الرسالة — يُستعمل في تفاصيل إشعار الرسالة (مقطوع ومطهّف) */
export function messageExcerpt(content: string, max = 90): string {
  const clean = String(content || "").replace(/\s+/g, " ").trim();
  if (!clean) return "…";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** تنسيق موعد قصير وموحّد بالأرقام اللاتينية: YYYY/MM/DD — HH:MM (توقيت الجزائر) */
export function formatWhenUTC1(d: Date | string): string {
  const dt = new Date(typeof d === "string" ? d : d.getTime());
  const shifted = new Date(dt.getTime() + 60 * 60 * 1000);
  const iso = shifted.toISOString();
  return `${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)} — ${iso.slice(11, 16)}`;
}

/**
 * إشعار موحّد: Push فوري على الجهاز + إشعار داخلي في جرس الموقع.
 * كلاهما باللغة المفضلة للمستخدم المسجلة في حسابه.
 * vars: متغيرات القالب — تُدمج في النص قبل الحفظ.
 */
export async function notifyUser(
  userId: string,
  key: NotifKey,
  url: string = "/",
  vars?: Record<string, string>
): Promise<{ sent: number }> {
  const lang = await langOf(userId);
  const tpl = TEXTS[key][lang];
  const title = fill(tpl.title, vars);
  const body = fill(tpl.body, vars);

  /* إشعار داخلي في جرس الموقع (يبقى حتى يقرأه المستخدم) */
  try {
    await InAppNotification.create({ userId, key, title, body, url });
  } catch (e) {
    console.error("[NOTIFY] تعذر حفظ الإشعار الداخلي:", (e as Error).message);
  }

  const r = await sendPushToUser(userId, title, body, url);
  return { sent: r.sent };
}

/**
 * إشعار رسالة جديدة داخل غرفة الجلسة: يُرسل فقط عندما يكون الطرف المستلم
 * بعيداً عن الغرفة (آخر نبض له أقدم من نافذة الحضور) — مع اسم المرسل
 * واقتباس من الرسالة (v2.8.0: تفاصيل الرسالة كما طلب المستخدم).
 * v2.9.0: رابط الإشعار (?session={id}) يفتح غرفة الجلسة مباشرة عند الضغط.
 */
export async function notifyNewMessage(
  partnerUserId: string,
  senderName: string,
  excerpt?: string,
  sessionId?: string
): Promise<{ sent: number }> {
  const lang = await langOf(partnerUserId);
  const tpl = TEXTS.message[lang];
  const safeName = String(senderName || "").trim().slice(0, 60);
  const fallbackName = lang === "ar" ? "الطرف الآخر" : lang === "fr" ? "l'autre partie" : "the other party";
  const title = tpl.title;
  const body = fill(tpl.body, {
    name: safeName || fallbackName,
    excerpt: (excerpt || "").slice(0, 120),
  });

  const targetUrl = sessionId ? `/?session=${encodeURIComponent(sessionId)}` : "/";
  try {
    await InAppNotification.create({
      userId: partnerUserId,
      key: "message",
      title,
      body,
      url: targetUrl,
    });
  } catch (e) {
    console.error("[NOTIFY] تعذر حفظ إشعار الرسالة:", (e as Error).message);
  }

  const r = await sendPushToUser(partnerUserId, title, body, targetUrl);
  return { sent: r.sent };
}

/**
 * v2.8.0 — إشعار رسالة في محادثة ما قبل الجلسة (DM).
 * يُرسل فقط عندما يكون المستلم غائباً عن المنصة: آخر نبض عام له
 * (lastSeenAt — يُحدَّث مع كل فحص للجرس) أقدم من نافذة الحضور.
 */
const GLOBAL_PRESENCE_WINDOW_MS = 45_000;

export async function notifyDmMessage(
  partnerUserId: string,
  senderName: string,
  excerpt: string,
  senderId?: string
): Promise<{ sent: number; skipped: boolean }> {
  const partner = (await User.findById(partnerUserId).select("language lastSeenAt").lean()) as {
    language?: string;
    lastSeenAt?: Date | null;
  } | null;
  if (!partner) return { sent: 0, skipped: true };

  /* حاضر في المنصة الآن؟ → لا إشعار (يصفّي المحادثة بنفسه) */
  const seen = partner.lastSeenAt ? new Date(partner.lastSeenAt as unknown as string).getTime() : 0;
  if (seen && Date.now() - seen < GLOBAL_PRESENCE_WINDOW_MS) {
    return { sent: 0, skipped: true };
  }

  const lang = (partner.language && NOTIF_LANGS.includes(partner.language as NotifLang)
    ? (partner.language as NotifLang)
    : "ar") as NotifLang;
  const tpl = TEXTS.dm[lang];
  const safeName = String(senderName || "").trim().slice(0, 60);
  const fallbackName =
    lang === "ar" ? "طرف المحادثة"
    : lang === "fr" ? "votre interlocuteur"
    : lang === "tr" ? "sohbet ortağınız"
    : lang === "ru" ? "ваш собеседник"
    : lang === "zh" ? "聊天对象"
    : "your chat partner";
  const title = tpl.title;
  const body = fill(tpl.body, { name: safeName || fallbackName, excerpt: excerpt.slice(0, 120) });

  /* v2.9.0: الضغط على الإشعار يفتح المحادثة مع المرسل مباشرة */
  const targetUrl = senderId ? `/?dm=${encodeURIComponent(senderId)}` : "/";
  try {
    await InAppNotification.create({ userId: partnerUserId, key: "dm", title, body, url: targetUrl });
  } catch (e) {
    console.error("[NOTIFY] تعذر حفظ إشعار المحادثة:", (e as Error).message);
  }

  const r = await sendPushToUser(partnerUserId, title, body, targetUrl);
  return { sent: r.sent, skipped: false };
}

/**
 * v2.10.0 — رسالة جديدة في محادثة المختص مع الإدارة:
 * • من المختص → تُخزَّن إشعارات داخلية لكل حسابات الإدارة (ويُدفع push)
 *   بذكر اسم المختص واقتباس الرسالة.
 * • من الإدارة → إشعار للمختص برابط ?admin-chat=1 يفتح صفحة المحادثة مباشرة.
 * كلاهما يُرسل فقط للطرف الغائب عن المنصة (آخر نبض عام).
 */
export async function notifyAdminChatMessage(
  opts: { fromAdmin: boolean; counselorId: string; senderName: string; excerpt: string }
): Promise<{ sent: number }> {
  const { fromAdmin, counselorId, senderName, excerpt } = opts;
  let sent = 0;

  if (!fromAdmin) {
    /* المختص راسل الإدارة → أبلغ كل حسابات الإدارة */
    const admins = (await User.find({ role: "ADMIN" }).select("_id lastSeenAt language").lean()) as {
      _id: unknown;
      lastSeenAt?: Date | null;
      language?: string;
    }[];
    for (const a of admins) {
      try {
        const seen = a.lastSeenAt ? new Date(a.lastSeenAt as unknown as string).getTime() : 0;
        if (seen && Date.now() - seen < GLOBAL_PRESENCE_WINDOW_MS) continue; /* حاضر — لا إزعاج */
        const lang = (a.language && NOTIF_LANGS.includes(a.language as NotifLang) ? (a.language as NotifLang) : "ar") as NotifLang;
        const tpl = TEXTS.adminChat[lang];
        const title = tpl.title;
        const body = fill(tpl.body, { name: String(senderName || "").slice(0, 60) || "—", excerpt: String(excerpt || "").slice(0, 120) });
        await InAppNotification.create({ userId: String(a._id), key: "adminChat", title, body, url: "/" });
        const r = await sendPushToUser(String(a._id), title, body, "/");
        sent += r.sent > 0 ? 1 : 0;
      } catch {
        /* إشعار واحد فاشل لا يوقف البقية */
      }
    }
    return { sent };
  }

  /* الإدارة ردّت → أبلغ المختص برابط يفتح محادثة الإدارة مباشرة */
  const counselor = (await User.findById(counselorId).select("language lastSeenAt").lean()) as {
    language?: string;
    lastSeenAt?: Date | null;
  } | null;
  if (!counselor) return { sent: 0 };
  const seen = counselor.lastSeenAt ? new Date(counselor.lastSeenAt as unknown as string).getTime() : 0;
  if (seen && Date.now() - seen < GLOBAL_PRESENCE_WINDOW_MS) return { sent: 0, skipped: true } as { sent: number; skipped?: boolean };
  const lang = (counselor.language && NOTIF_LANGS.includes(counselor.language as NotifLang) ? (counselor.language as NotifLang) : "ar") as NotifLang;
  const tpl = TEXTS.adminChat[lang];
  const title = tpl.title;
  const body = fill(tpl.body, { name: String(senderName || "").slice(0, 60) || "—", excerpt: String(excerpt || "").slice(0, 120) });
  const targetUrl = "/?admin-chat=1";
  try {
    await InAppNotification.create({ userId: counselorId, key: "adminChat", title, body, url: targetUrl });
  } catch (e) {
    console.error("[NOTIFY] تعذر حفظ إشعار محادثة الإدارة:", (e as Error).message);
  }
  const r = await sendPushToUser(counselorId, title, body, targetUrl);
  return { sent: r.sent };
}

/**
 * v2.8.0 — إشعار جماعي من الإدارة: نص بلغة كل مستخدم (العربية احتياطاً).
 * يعيد عدد المرسل بنجاح. يُستدعى من action bulk-notify في /api/admin.
 */
export async function notifyBulk(
  userIds: string[],
  textAr: string,
  textFr?: string,
  textEn?: string
): Promise<{ sent: number }> {
  let sent = 0;
  for (const id of userIds) {
    try {
      const lang = await langOf(id);
      const text = lang === "fr" ? textFr || textAr : lang === "en" ? textEn || textAr : textAr;
      const tpl = TEXTS.bulk[lang];
      const title = tpl.title;
      const body = fill(tpl.body, { text: String(text || "").slice(0, 500) });
      await InAppNotification.create({ userId: id, key: null, title, body, url: "/" });
      const r = await sendPushToUser(id, title, body, "/");
      sent += r.sent > 0 ? 1 : 0;
    } catch {
      /* مستخدم فاشل لا يوقف البقية */
    }
  }
  return { sent };
}

/**
 * v2.9.0 — إشعار فوز تحدي الالتزام للمتضررين — يصل لكل حسابات الأدمين
 * (أو المعرّف الاصطناعي "admin" كاحتياط) باسم الفائز الأول.
 */
export async function notifyAdminVictimChallengeWinner(winnerName: string): Promise<{ sent: number }> {
  const admins = (await User.find({ role: "ADMIN" }).select("_id").lean()) as { _id: unknown }[];
  const targets: string[] = admins.map((a) => String(a._id));
  if (targets.length === 0) targets.push("admin");

  let sent = 0;
  for (const id of targets) {
    try {
      const lang = await langOf(id).catch(() => "ar" as NotifLang);
      const tpl = TEXTS.victimChallenge[lang];
      const title = tpl.title;
      const body = tpl.body.split("{name}").join(String(winnerName || "—").slice(0, 80));
      await InAppNotification.create({ userId: id, key: "victimChallenge", title, body, url: "/" });
      const r = await sendPushToUser(id, title, body, "/");
      sent += r.sent > 0 ? 1 : 0;
    } catch {
      /* فشل إشعار أدمين واحد لا يوقف البقية */
    }
  }
  return { sent };
}

/**
 * v2.9.0 — إشعار نتيجة مراجعة التحقق من التضرر من الحرائق للمتضرر.
 */
export async function notifyVictimVerification(
  victimId: string,
  approved: boolean
): Promise<{ sent: number }> {
  const lang = await langOf(victimId);
  const tpl = TEXTS[approved ? "victimVerified" : "victimRejected"][lang];
  const title = tpl.title;
  const body = tpl.body;
  try {
    await InAppNotification.create({ userId: victimId, key: approved ? "victimVerified" : "victimRejected", title, body, url: "/" });
  } catch (e) {
    console.error("[NOTIFY] تعذر حفظ إشعار التحقق:", (e as Error).message);
  }
  const r = await sendPushToUser(victimId, title, body, "/");
  return { sent: r.sent };
}

/**
 * v2.7.0 — إشعار فوز التحدي السري: يصل لكل حسابات الأدمين (أو المعرّف
 * الاصطناعي "admin" كاحتياط إن لم يوجد حساب) باسم الفائز الأول.
 */
export async function notifyAdminChallengeWinner(winnerName: string): Promise<{ sent: number }> {
  const admins = (await User.find({ role: "ADMIN" }).select("_id language").lean()) as {
    _id: unknown;
    language?: string;
  }[];
  let sent = 0;

  const TEXTS_ADMIN = {
    ar: { title: "👑 فائز جديد في تحدي المنصة!", body: "أول فائز بالتحدي السري: {name} — راجع لوحة الإدارة للتفاصيل" },
    fr: { title: "👑 Nouveau gagnant du défi !", body: "Premier gagnant du défi secret : {name} — consultez le panneau d'administration" },
    en: { title: "👑 New challenge winner!", body: "First winner of the secret challenge: {name} — check the admin panel" },
  };

  const targets: string[] = admins.map((a) => String(a._id));
  if (targets.length === 0) targets.push("admin"); // المعرّف الاصطناعي — Mixed يقبله

  for (const id of targets) {
    try {
      const lang = await langOf(id).catch(() => "ar" as const);
      const tpl = TEXTS_ADMIN[lang === "fr" || lang === "en" ? lang : "ar"];
      const title = tpl.title;
      const body = tpl.body.split("{name}").join(String(winnerName || "—").slice(0, 80));
      await InAppNotification.create({ userId: id, key: "challengeWon", title, body, url: "/" });
      const r = await sendPushToUser(id, title, body, "/");
      sent += r.sent > 0 ? 1 : 0;
    } catch {
      /* فشل إشعار أدمين واحد لا يوقف البقية */
    }
  }
  return { sent };
}
